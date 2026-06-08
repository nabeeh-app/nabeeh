'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Award,
  BookOpen,
  Calculator,
  Download,
  Upload,
  Filter,
  Search,
  Edit,
  Trash2,
  Eye,
  BarChart3,
  FileSpreadsheet,
  Target
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Student, Grade, CreateGradeRequest, Offering } from '@/types';
import { AlertCircle, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatCards } from '@/components/ui/StatCards';
import { EmptyState } from '@/components/ui/EmptyState';
import { ViewModeTabs } from '@/components/ui/ViewModeTabs';
import logger from '@/lib/logger';

interface GradeWithStudent extends Grade {
  student: Student;
}

interface GradebookEntry {
  student_id: string;
  student_name: string;
  grades: {
    [assessment_name: string]: {
      score: number;
      max_score: number;
      percentage: number;
      date: string;
    };
  };
  average: number;
  letter_grade: string;
}

interface SubjectStats {
  subject: string;
  total_assessments: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  student_count: number;
}

export default function GradesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<GradeWithStudent[]>([]);
  const [gradebook, setGradebook] = useState<GradebookEntry[]>([]);
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [openGroupSelect, setOpenGroupSelect] = useState(false);
  const [noGroups, setNoGroups] = useState(false);

  const [viewMode, setViewMode] = useState<'gradebook' | 'list' | 'entry'>('gradebook');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<string>('all');

  const [isAddGradeModalOpen, setAddGradeModalOpen] = useState(false);
  const [isBulkEntryModalOpen, setBulkEntryModalOpen] = useState(false);
  const [isStatsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<GradeWithStudent | null>(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const currentSubjectName = (() => {
    for (const offering of offerings) {
      if (offering.groups.find((g) => g.id === selectedGroupId)) {
        return offering.subject.name_en;
      }
    }
    return '';
  })();

  const [newGrade, setNewGrade] = useState<CreateGradeRequest>({
    student_id: '',
    group_id: '',
    subject: currentSubjectName,
    assessment_type: 'test',
    assessment_name: '',
    score: 0,
    max_score: 100,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [formError, setFormError] = useState('');

  const [alertDialog, setAlertDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive';
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  useEffect(() => {
    loadOfferings();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      loadInitialData();
    } else if (offerings.length > 0) {
      setStudents([]);
      setGrades([]);
    }
  }, [selectedGroupId, dateRange]);

  const loadOfferings = async () => {
    try {
      const data = await apiClient.getOfferings();
      setOfferings(data || []);

      const groups = (data || []).flatMap((offering: { groups?: { id: string }[] }) => offering.groups ?? []);
      if (groups.length === 0) {
        setNoGroups(true);
        setLoading(false);
        router.replace(`/${locale}/dashboard/classes?setup=required`);
        return;
      }
      setNoGroups(false);
      if (groups[0]) {
        setSelectedGroupId(groups[0].id);
      }
    } catch (err) {
      logger.error('Error loading offerings:', err);
    }
  };

  useEffect(() => {
    if (grades.length > 0 && students.length > 0) {
      generateGradebook();
      calculateSubjectStats();
    }
  }, [grades, students]);

  useEffect(() => {
    if (!selectedGroupId) return;
    setNewGrade(prev => ({
      ...prev,
      group_id: selectedGroupId,
      subject: currentSubjectName || prev.subject
    }));
  }, [selectedGroupId, currentSubjectName]);

  const loadInitialData = async () => {
    if (!selectedGroupId) return;

    try {
      setLoading(true);
      setError(null);

      let selectedSubjectName = '';
      offerings.forEach(offering => {
        const group = offering.groups.find((g) => g.id === selectedGroupId);
        if (group) {
          selectedSubjectName = offering.subject.name_en;
        }
      });

      const studentsResponse = await apiClient.getStudents({
        limit: 100,
        status: 'active',
        group_id: selectedGroupId
      });
      setStudents(studentsResponse.data);

      const gradesResponse = await apiClient.getGrades({
        limit: 500,
        start_date: dateRange.from,
        end_date: dateRange.to,
        subject: selectedSubjectName,
        group_id: selectedGroupId,
      });

      const studentIds = new Set(studentsResponse.data.map(s => s.id));
      const gradesWithStudents = gradesResponse.data
        .filter(g => studentIds.has(g.student_id))
        .map(grade => ({
          ...grade,
          student: studentsResponse.data.find(s => s.id === grade.student_id) || {} as Student
        }));

      setGrades(gradesWithStudents);

    } catch (err: any) {
      logger.error('Error loading grades data:', err);
      setError(err.message || 'Failed to load grades data');
    } finally {
      setLoading(false);
    }
  };

  const generateGradebook = () => {
    const filteredStudents = students;

    const gradebookData: GradebookEntry[] = filteredStudents.map(student => {
      const studentGrades = grades.filter(g =>
        g.student_id === student.id
      );

      const gradesMap: { [key: string]: any } = {};
      studentGrades.forEach(grade => {
        gradesMap[grade.assessment_name] = {
          score: grade.score,
          max_score: grade.max_score,
          percentage: grade.percentage,
          date: grade.date
        };
      });

      const average = studentGrades.length > 0
        ? studentGrades.reduce((sum, grade) => sum + grade.percentage, 0) / studentGrades.length
        : 0;

      const letterGrade = getLetterGrade(average);

      return {
        student_id: student.id,
        student_name: student.name,
        grades: gradesMap,
        average: Math.round(average * 100) / 100,
        letter_grade: letterGrade
      };
    });

    setGradebook(gradebookData);
  };

  const calculateSubjectStats = () => {
    const subjects = [...new Set(grades.map(g => g.subject))];

    const stats: SubjectStats[] = subjects.map(subject => {
      const subjectGrades = grades.filter(g => g.subject === subject);
      const scores = subjectGrades.map(g => g.percentage);

      return {
        subject,
        total_assessments: subjectGrades.length,
        average_score: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        highest_score: scores.length > 0 ? Math.max(...scores) : 0,
        lowest_score: scores.length > 0 ? Math.min(...scores) : 0,
        student_count: [...new Set(subjectGrades.map(g => g.student_id))].length
      };
    });

    setSubjectStats(stats);
  };

  const getLetterGrade = (percentage: number): string => {
    if (percentage >= 95) return 'A+';
    if (percentage >= 90) return 'A';
    if (percentage >= 85) return 'A-';
    if (percentage >= 80) return 'B+';
    if (percentage >= 75) return 'B';
    if (percentage >= 70) return 'B-';
    if (percentage >= 65) return 'C+';
    if (percentage >= 60) return 'C';
    if (percentage >= 55) return 'C-';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const getGradeColor = (percentage: number): string => {
    if (percentage >= 85) return 'text-green-600 bg-green-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();

    const gradeToSubmit = { ...newGrade };
    if (!gradeToSubmit.subject && currentSubjectName) {
      gradeToSubmit.subject = currentSubjectName;
    }

    const gradeWithGroup = {
      ...gradeToSubmit,
      group_id: gradeToSubmit.group_id || selectedGroupId
    };

    if (!gradeWithGroup.group_id || !gradeWithGroup.student_id || !gradeWithGroup.subject || !gradeWithGroup.assessment_name) {
      setFormError(t('grades.validation.fillRequired'));
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const createdGrade = await apiClient.createGrade(gradeWithGroup);
      const student = students.find(s => s.id === gradeWithGroup.student_id);

      if (student) {
        const gradeWithStudent: GradeWithStudent = {
          ...createdGrade,
          student
        };
        setGrades(prev => [...prev, gradeWithStudent]);
      }

      setAddGradeModalOpen(false);
      resetForm();

    } catch (err: any) {
      logger.error('Error creating grade:', err);
      setFormError(err.message || 'Failed to create grade');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditGrade = (grade: GradeWithStudent) => {
    setSelectedGrade(grade);
    setNewGrade({
      student_id: grade.student_id,
      group_id: grade.group_id || selectedGroupId,
      subject: grade.subject,
      assessment_type: grade.assessment_type,
      assessment_name: grade.assessment_name,
      score: grade.score,
      max_score: grade.max_score,
      date: grade.date,
      notes: grade.notes || ''
    });
    setEditModalOpen(true);
  };

  const handleUpdateGrade = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedGrade) return;
    if (!newGrade.group_id && !selectedGroupId) {
      setFormError(t('grades.validation.selectClass'));
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const payload = {
        ...newGrade,
        group_id: newGrade.group_id || selectedGroupId
      };
      const updatedGrade = await apiClient.updateGrade(selectedGrade.id, payload);

      setGrades(prev =>
        prev.map(g => g.id === selectedGrade.id
          ? { ...updatedGrade, student: g.student }
          : g
        )
      );

      setEditModalOpen(false);
      setSelectedGrade(null);
      resetForm();

    } catch (err: any) {
      logger.error('Error updating grade:', err);
      setFormError(err.message || 'Failed to update grade');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGrade = async (grade: GradeWithStudent) => {
    setAlertDialog({
      open: true,
      title: t('common.delete'),
      description: t('grades.deleteConfirm'),
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await apiClient.deleteGrade(grade.id);
          setGrades(prev => prev.filter(g => g.id !== grade.id));
        } catch (err: any) {
          logger.error('Error deleting grade:', err);
          setAlertDialog({
            open: true,
            title: t('errors.generic'),
            description: err.message || t('errors.generic'),
            onConfirm: () => setAlertDialog(prev => ({ ...prev, open: false })),
          });
        }
      },
    });
  };

  const resetForm = () => {
    setNewGrade({
      student_id: '',
      group_id: selectedGroupId || '',
      subject: '',
      assessment_type: 'test',
      assessment_name: '',
      score: 0,
      max_score: 100,
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    if (currentSubjectName) {
      setNewGrade(prev => ({ ...prev, subject: currentSubjectName }));
    }
    setFormError('');
  };

  const uniqueSubjects = [...new Set(grades.map(g => g.subject))];
  const uniqueAssessments = [...new Set(grades.map(g => g.assessment_name))];
  const assessmentTypes = ['test', 'quiz', 'homework', 'project', 'midterm', 'final'];

  const filteredGrades = grades.filter(grade => {
    const matchesSearch = grade.student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grade.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grade.assessment_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAssessmentType = selectedAssessmentType === 'all' || grade.assessment_type === selectedAssessmentType;
    const matchesGradeFilter = gradeFilter === 'all' || getLetterGrade(grade.percentage) === gradeFilter;

    return matchesSearch && matchesAssessmentType && matchesGradeFilter;
  });

  if (loading) {
    return <LoadingSpinner message={t('grades.loading')} />;
  }

  if (noGroups) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {t('grades.noGroups')}
            </p>
            <p className="text-sm text-amber-700">
              {t('grades.noGroupsDescription')}
            </p>
          </div>
          <Button asChild variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100">
            <Link href={`/${locale}/dashboard/classes?setup=required`}>
              {t('grades.setUpGroups')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const stats = [
    { icon: GraduationCap, value: grades.length, label: t('grades.totalGrades'), color: 'primary' as const },
    { icon: BookOpen, value: uniqueSubjects.length, label: t('grades.subjectsLabel'), color: 'success' as const },
    { icon: Calculator, value: grades.length > 0 ? (grades.reduce((sum, g) => sum + g.percentage, 0) / grades.length).toFixed(1) + '%' : '0%', label: t('grades.overallAverage'), color: 'accent' as const },
    { icon: Award, value: grades.filter(g => g.percentage >= 90).length, label: t('grades.excellentGrades'), color: 'warning' as const },
  ];

  const viewModes = [
    { id: 'gradebook', label: t('grades.gradebook'), icon: FileSpreadsheet },
    { id: 'list', label: t('grades.gradeList'), icon: GraduationCap },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('grades.title')}
        description={t('grades.descriptionCount')}
      >
        <Select
          value={selectedGroupId}
          onValueChange={setSelectedGroupId}
        >
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder={t('students.fields.group')} />
          </SelectTrigger>
          <SelectContent>
            {offerings.map((offering) => (
              offering.groups.map((group: any) => (
                <SelectItem key={group.id} value={group.id}>
                  {offering.subject.name_en} - {group.name}
                </SelectItem>
              ))
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          {t('common.export')}
        </Button>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          {t('common.import')}
        </Button>
        <Dialog open={isStatsModalOpen} onOpenChange={setStatsModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <BarChart3 className="w-4 h-4 mr-2" />
              {t('grades.gradeStatistics')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {t('grades.gradeStatistics')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {subjectStats.map((stat, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{stat.subject}</h3>
                      <Badge variant="outline">
                        {t('grades.studentsCount', { count: stat.student_count })}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">{t('grades.averageLabel')}</div>
                        <div className="font-medium">{stat.average_score.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-gray-600">{t('grades.stats.highestScore')}</div>
                        <div className="font-medium text-green-600">{stat.highest_score}%</div>
                      </div>
                      <div>
                        <div className="text-gray-600">{t('grades.stats.lowestScore')}</div>
                        <div className="font-medium text-red-600">{stat.lowest_score}%</div>
                      </div>
                      <div>
                        <div className="text-gray-600">{t('grades.stats.totalAssessments')}</div>
                        <div className="font-medium">{stat.total_assessments}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isAddGradeModalOpen} onOpenChange={setAddGradeModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={!selectedGroupId}>
              <Plus className="w-4 h-4" />
              {t('grades.addGrade')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t('grades.addNewGrade')}
                {currentSubjectName && ` - ${currentSubjectName}`}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddGrade} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="student_id">
                    {t('grades.fields.student')} *
                  </Label>
                  <Select
                    value={newGrade.student_id}
                    onValueChange={(value) => setNewGrade(s => ({ ...s, student_id: value }))}
                  >
                    <SelectTrigger id="student_id">
                      <SelectValue placeholder={t('grades.selectStudent')} />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map(student => (
                        <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subject">
                    {t('grades.fields.subject')} *
                  </Label>
                  <Input
                    id="subject"
                    value={newGrade.subject || currentSubjectName}
                    onChange={(e) => setNewGrade(s => ({ ...s, subject: e.target.value }))}
                    placeholder={t('grades.subjectPlaceholder')}
                    required
                    disabled={!!currentSubjectName}
                  />
                </div>
                <div>
                  <Label htmlFor="assessment_type">
                    {t('grades.fields.assessmentType')} *
                  </Label>
                  <Select
                    value={newGrade.assessment_type}
                    onValueChange={(value) => setNewGrade(s => ({ ...s, assessment_type: value }))}
                  >
                    <SelectTrigger id="assessment_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assessmentTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {t(`grades.assessmentTypes.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="assessment_name">
                    {t('grades.fields.assessmentName')} *
                  </Label>
                  <Input
                    id="assessment_name"
                    value={newGrade.assessment_name}
                    onChange={(e) => setNewGrade(s => ({ ...s, assessment_name: e.target.value }))}
                    placeholder={t('grades.assessmentNamePlaceholder')}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="score">
                    {t('grades.fields.score')} *
                  </Label>
                  <Input
                    id="score"
                    type="number"
                    min="0"
                    step="0.5"
                    value={newGrade.score}
                    onChange={(e) => setNewGrade(s => ({ ...s, score: parseFloat(e.target.value) || 0 }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="max_score">
                    {t('grades.fields.maxScore')} *
                  </Label>
                  <Input
                    id="max_score"
                    type="number"
                    min="1"
                    value={newGrade.max_score}
                    onChange={(e) => setNewGrade(s => ({ ...s, max_score: parseFloat(e.target.value) || 100 }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="date">
                    {t('grades.fields.date')} *
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={newGrade.date}
                    onChange={(e) => setNewGrade(s => ({ ...s, date: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">
                  {t('grades.fields.notes')}
                </Label>
                <textarea
                  id="notes"
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  value={newGrade.notes}
                  onChange={(e) => setNewGrade(s => ({ ...s, notes: e.target.value }))}
                  placeholder={t('grades.notesPlaceholder')}
                />
              </div>
              {formError && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded">
                  {formError}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddGradeModalOpen(false)}
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? t('grades.saving')
                    : t('common.save')
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <StatCards stats={stats} />

      <div className="flex items-center justify-between">
        <ViewModeTabs
          modes={viewModes}
          active={viewMode}
          onChange={(mode) => setViewMode(mode as 'gradebook' | 'list')}
        />

        <div className="flex items-center space-x-2">
          <Input
            placeholder={t('grades.searchEllipsis')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
        </div>
      </div>

      {/* Gradebook View */}
      {viewMode === 'gradebook' && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t('grades.gradebook')}
              {currentSubjectName && ` - ${currentSubjectName}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gradebook.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                message={t('grades.noGradesDisplay')}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">
                        {t('grades.fields.student')}
                      </TableHead>
                      {uniqueAssessments.slice(0, 5).map(assessment => (
                        <TableHead key={assessment} className="text-center min-w-[120px]">
                          {assessment}
                        </TableHead>
                      ))}
                      <TableHead className="text-center min-w-[100px]">
                        {t('grades.averageLabel')}
                      </TableHead>
                      <TableHead className="text-center min-w-[80px]">
                        {t('grades.gradeLabel')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradebook.map((entry) => (
                      <TableRow key={entry.student_id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {entry.student_name.split(' ')[0].charAt(0)}
                                {entry.student_name.split(' ')[1]?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{entry.student_name}</span>
                          </div>
                        </TableCell>
                        {uniqueAssessments.slice(0, 5).map(assessment => (
                          <TableCell key={assessment} className="text-center">
                            {entry.grades[assessment] ? (
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {entry.grades[assessment].score}/{entry.grades[assessment].max_score}
                                </div>
                                <div className={`text-xs px-2 py-1 rounded ${getGradeColor(entry.grades[assessment].percentage)}`}>
                                  {entry.grades[assessment].percentage}%
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          <div className={`font-bold px-3 py-1 rounded ${getGradeColor(entry.average)}`}>
                            {entry.average}%
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={getGradeColor(entry.average)}>
                            {entry.letter_grade}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('grades.gradeList')}</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredGrades.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                message={t('grades.noGradesMatch')}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('grades.fields.student')}</TableHead>
                    <TableHead>{t('grades.fields.subject')}</TableHead>
                    <TableHead>{t('grades.assessment')}</TableHead>
                    <TableHead>{t('grades.fields.score')}</TableHead>
                    <TableHead>{t('grades.percentageLabel')}</TableHead>
                    <TableHead>{t('grades.gradeLabel')}</TableHead>
                    <TableHead>{t('grades.fields.date')}</TableHead>
                    <TableHead>{t('grades.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGrades.map((grade) => (
                    <TableRow key={grade.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-gray-100 text-gray-600">
                              {grade.student?.name?.split(' ')[0]?.charAt(0)}
                              {grade.student?.name?.split(' ')[1]?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{grade.student?.name || 'Unknown'}</div>
                            <div className="text-sm text-gray-500">
                              {grade.student?.grade_level}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{grade.subject}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{grade.assessment_name}</div>
                          <div className="text-sm text-gray-500 capitalize">
                            {grade.assessment_type}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {grade.score}/{grade.max_score}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className={`font-medium px-2 py-1 rounded text-center ${getGradeColor(grade.percentage)}`}>
                          {grade.percentage}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getGradeColor(grade.percentage)}>
                          {grade.letter_grade || getLetterGrade(grade.percentage)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {new Date(grade.date).toLocaleDateString(
                            locale === 'ar' ? 'ar-SA' : 'en-US'
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditGrade(grade)}
                            title={t('common.edit')}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteGrade(grade)}
                            className="text-red-600 hover:text-red-700"
                            title={t('common.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Grade Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('grades.editGradeTitle')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateGrade} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_score">
                  {t('grades.fields.score')} *
                </Label>
                <Input
                  id="edit_score"
                  type="number"
                  min="0"
                  step="0.5"
                  value={newGrade.score}
                  onChange={(e) => setNewGrade(s => ({ ...s, score: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_max_score">
                  {t('grades.fields.maxScore')} *
                </Label>
                <Input
                  id="edit_max_score"
                  type="number"
                  min="1"
                  value={newGrade.max_score}
                  onChange={(e) => setNewGrade(s => ({ ...s, max_score: parseFloat(e.target.value) || 100 }))}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit_notes">
                {t('grades.fields.notes')}
              </Label>
              <textarea
                id="edit_notes"
                className="w-full border rounded px-3 py-2"
                rows={3}
                value={newGrade.notes}
                onChange={(e) => setNewGrade(s => ({ ...s, notes: e.target.value }))}
                placeholder={t('grades.notesPlaceholder')}
              />
            </div>
            {formError && (
              <div className="text-red-500 text-sm bg-red-50 p-3 rounded">
                {formError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                disabled={submitting}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? t('grades.saving')
                  : t('common.save')
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={alertDialog.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => {
                alertDialog.onConfirm();
                setAlertDialog(prev => ({ ...prev, open: false }));
              }}
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
