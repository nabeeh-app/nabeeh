'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Student, Grade, CreateGradeRequest } from '@/types';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatCards } from '@/components/ui/StatCards';
import { EmptyState } from '@/components/ui/EmptyState';
import { ViewModeTabs } from '@/components/ui/ViewModeTabs';
import { useOfferings } from '@/hooks/useOfferings';
import { useStudents } from '@/hooks/useStudents';
import { useGrades, useCreateGrade, useUpdateGrade, useDeleteGrade } from '@/hooks/useGrades';
import { useVirtualizer } from '@tanstack/react-virtual';

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
  if (percentage >= 85) return 'text-[#026370] bg-surface-sage';
  if (percentage >= 70) return 'text-ink/70 bg-surface-cool';
  return 'text-[#c53030] bg-[#c53030]/10';
};

export default function GradesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'gradebook' | 'list'>('gradebook');
  const [selectedAssessmentType] = useState<string>('all');
  const [isAddGradeModalOpen, setAddGradeModalOpen] = useState(false);
  const [isStatsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<GradeWithStudent | null>(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter] = useState<string>('all');
  const [dateRange] = useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  
  const gradebookScrollRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);

  const { data: offerings = [], isLoading: offeringsLoading } = useOfferings();

  const groups = useMemo(() => offerings.flatMap(o => o.groups ?? []), [offerings]);

  useEffect(() => {
    if (groups.length === 0 && !offeringsLoading) {
      router.replace(`/${locale}/dashboard/classes?setup=required`);
    }
  }, [groups, offeringsLoading, locale, router]);

  const effectiveSelectedGroupId = useMemo(
    () => selectedGroupId || groups[0]?.id || '',
    [selectedGroupId, groups]
  );

  const currentSubjectName = useMemo(() => {
    for (const offering of offerings) {
      if (offering.groups.find((g) => g.id === effectiveSelectedGroupId)) {
        return offering.subject.name_en;
      }
    }
    return '';
  }, [offerings, effectiveSelectedGroupId]);

  const studentsParams = useMemo(() => effectiveSelectedGroupId ? {
    limit: 100,
    status: 'active',
    group_id: effectiveSelectedGroupId,
  } : undefined, [effectiveSelectedGroupId]);

  const gradesParams = useMemo(() => effectiveSelectedGroupId ? {
    limit: 500,
    start_date: dateRange.from,
    end_date: dateRange.to,
    subject: currentSubjectName || undefined,
    group_id: effectiveSelectedGroupId,
  } : undefined, [effectiveSelectedGroupId, dateRange, currentSubjectName]);

  const { data: studentsResponse, isLoading: studentsLoading } = useStudents(studentsParams);
  const students: Student[] = useMemo(() => studentsResponse?.data ?? [], [studentsResponse]);

  const { data: gradesResponse, isLoading: gradesLoading } = useGrades(gradesParams);
  const grades: GradeWithStudent[] = useMemo(() => {
    const rawGrades = gradesResponse?.data ?? [];
    const studentIds = new Set(students.map(s => s.id));
    return rawGrades
      .filter((g: Grade) => studentIds.has(g.student_id))
      .map((grade: Grade) => ({
        ...grade,
        student: students.find(s => s.id === grade.student_id) || {} as Student
      }));
  }, [gradesResponse, students]);

  const createGrade = useCreateGrade();
  const updateGrade = useUpdateGrade();
  const deleteGrade = useDeleteGrade();

  const [newGrade, setNewGrade] = useState<CreateGradeRequest>({
    student_id: '',
    group_id: '',
    subject: '',
    assessment_type: 'test',
    assessment_name: '',
    score: 0,
    max_score: 100,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [alertDialog, setAlertDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive';
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  useEffect(() => {
    if (!effectiveSelectedGroupId) return;
    void (async () => {
      setNewGrade(prev => ({
        ...prev,
        group_id: effectiveSelectedGroupId,
        subject: currentSubjectName || prev.subject
      }));
    })();
  }, [effectiveSelectedGroupId, currentSubjectName]);

  const gradebook: GradebookEntry[] = useMemo(() => {
    return students.map(student => {
      const studentGrades = grades.filter(g => g.student_id === student.id);
      const gradesMap: { [key: string]: { score: number; max_score: number; percentage: number; date: string } } = {};
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
      return {
        student_id: student.id,
        student_name: student.name,
        grades: gradesMap,
        average: Math.round(average * 100) / 100,
        letter_grade: getLetterGrade(average)
      };
    });
  }, [students, grades]);

  const subjectStats: SubjectStats[] = useMemo(() => {
    const subjects = [...new Set(grades.map(g => g.subject))];
    return subjects.map(subject => {
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
  }, [grades]);

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
      await createGrade.mutateAsync(gradeWithGroup);
      setAddGradeModalOpen(false);
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message || 'Failed to create grade');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditGrade = (grade: GradeWithStudent) => {
    setSelectedGrade(grade);
    setNewGrade({
      student_id: grade.student_id,
      group_id: grade.group_id || effectiveSelectedGroupId,
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
    if (!newGrade.group_id && !effectiveSelectedGroupId) {
      setFormError(t('grades.validation.selectClass'));
      return;
    }
    try {
      setSubmitting(true);
      setFormError('');
      const payload = { ...newGrade, group_id: newGrade.group_id || effectiveSelectedGroupId };
      await updateGrade.mutateAsync({ id: selectedGrade.id, data: payload });
      setEditModalOpen(false);
      setSelectedGrade(null);
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message || 'Failed to update grade');
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
          await deleteGrade.mutateAsync(grade.id);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          setAlertDialog({
            open: true,
            title: t('errors.generic'),
            description: message || t('errors.generic'),
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
      subject: currentSubjectName || '',
      assessment_type: 'test',
      assessment_name: '',
      score: 0,
      max_score: 100,
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setFormError('');
  };

  const uniqueSubjects = useMemo(() => [...new Set(grades.map(g => g.subject))], [grades]);
  const uniqueAssessments = useMemo(() => [...new Set(grades.map(g => g.assessment_name))], [grades]);
  const assessmentTypes = ['test', 'quiz', 'homework', 'project', 'midterm', 'final'];

  const filteredGrades = useMemo(() => {
    return grades.filter(grade => {
      const matchesSearch = grade.student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grade.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grade.assessment_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAssessmentType = selectedAssessmentType === 'all' || grade.assessment_type === selectedAssessmentType;
      const matchesGradeFilter = gradeFilter === 'all' || getLetterGrade(grade.percentage) === gradeFilter;
      return matchesSearch && matchesAssessmentType && matchesGradeFilter;
    });
  }, [grades, searchTerm, selectedAssessmentType, gradeFilter]);

  const gradebookVirtualizer = useVirtualizer({
    count: gradebook.length,
    getScrollElement: () => gradebookScrollRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  const listVirtualizer = useVirtualizer({
    count: filteredGrades.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  const isLoading = offeringsLoading || studentsLoading || gradesLoading;

  if (isLoading) {
    return <LoadingSpinner message={t('grades.loading')} />;
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/20 bg-surface-sage p-4 text-ink">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{t('grades.noGroups')}</p>
            <p className="text-sm text-ink/70">{t('grades.noGroupsDescription')}</p>
          </div>
          <Button asChild variant="outline" className="border-ink/20 text-ink hover:bg-surface-cool">
            <Link href={`/${locale}/dashboard/classes?setup=required`}>{t('grades.setUpGroups')}</Link>
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
        <Select value={effectiveSelectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder={t('students.fields.group')} />
          </SelectTrigger>
          <SelectContent>
            {offerings.map((offering) => (
              offering.groups.map((group) => (
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
              <DialogTitle>{t('grades.gradeStatistics')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {subjectStats.map((stat, index) => (
                <div key={index} className="p-4 bg-surface-sage/50 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{stat.subject}</h3>
                    <Badge variant="outline">{t('grades.studentsCount', { count: stat.student_count })}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-ink/60">{t('grades.averageLabel')}</div>
                      <div className="font-medium">{stat.average_score.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-ink/60">{t('grades.stats.highestScore')}</div>
                      <div className="font-medium text-[#026370]">{stat.highest_score}%</div>
                    </div>
                    <div>
                      <div className="text-ink/60">{t('grades.stats.lowestScore')}</div>
                      <div className="font-medium text-[#c53030]">{stat.lowest_score}%</div>
                    </div>
                    <div>
                      <div className="text-ink/60">{t('grades.stats.totalAssessments')}</div>
                      <div className="font-medium">{stat.total_assessments}</div>
                    </div>
                  </div>
                </div>
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
                  <Label htmlFor="student_id">{t('grades.fields.student')} *</Label>
                  <Select value={newGrade.student_id} onValueChange={(value) => setNewGrade(s => ({ ...s, student_id: value }))}>
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
                  <Label htmlFor="subject">{t('grades.fields.subject')} *</Label>
                  <Input id="subject" value={newGrade.subject || currentSubjectName} onChange={(e) => setNewGrade(s => ({ ...s, subject: e.target.value }))} placeholder={t('grades.subjectPlaceholder')} required disabled={!!currentSubjectName} />
                </div>
                <div>
                  <Label htmlFor="assessment_type">{t('grades.fields.assessmentType')} *</Label>
                  <Select value={newGrade.assessment_type} onValueChange={(value) => setNewGrade(s => ({ ...s, assessment_type: value }))}>
                    <SelectTrigger id="assessment_type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assessmentTypes.map(type => (
                        <SelectItem key={type} value={type}>{t(`grades.assessmentTypes.${type}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="assessment_name">{t('grades.fields.assessmentName')} *</Label>
                  <Input id="assessment_name" value={newGrade.assessment_name} onChange={(e) => setNewGrade(s => ({ ...s, assessment_name: e.target.value }))} placeholder={t('grades.assessmentNamePlaceholder')} required />
                </div>
                <div>
                  <Label htmlFor="score">{t('grades.fields.score')} *</Label>
                  <Input id="score" type="number" min="0" step="0.5" value={newGrade.score} onChange={(e) => setNewGrade(s => ({ ...s, score: parseFloat(e.target.value) || 0 }))} required />
                </div>
                <div>
                  <Label htmlFor="max_score">{t('grades.fields.maxScore')} *</Label>
                  <Input id="max_score" type="number" min="1" value={newGrade.max_score} onChange={(e) => setNewGrade(s => ({ ...s, max_score: parseFloat(e.target.value) || 100 }))} required />
                </div>
                <div>
                  <Label htmlFor="date">{t('grades.fields.date')} *</Label>
                  <Input id="date" type="date" value={newGrade.date} onChange={(e) => setNewGrade(s => ({ ...s, date: e.target.value }))} required />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">{t('grades.fields.notes')}</Label>
                <textarea id="notes" className="w-full border rounded px-3 py-2" rows={3} value={newGrade.notes} onChange={(e) => setNewGrade(s => ({ ...s, notes: e.target.value }))} placeholder={t('grades.notesPlaceholder')} />
              </div>
              {formError && (
                <div className="text-[#c53030] text-sm bg-[#c53030]/10 p-3 rounded">{formError}</div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddGradeModalOpen(false)} disabled={submitting}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={submitting}>{submitting ? t('grades.saving') : t('common.save')}</Button>
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
          <Input placeholder={t('grades.searchEllipsis')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-64" />
        </div>
      </div>

      {/* Gradebook View */}
      {viewMode === 'gradebook' && (
        <div className="space-y-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-ink font-display">
              {t('grades.gradebook')}
              {currentSubjectName && ` - ${currentSubjectName}`}
            </h2>
          </div>
          {gradebook.length === 0 ? (
            <EmptyState icon={GraduationCap} message={t('grades.noGradesDisplay')} />
          ) : (
            <div ref={gradebookScrollRef} className="overflow-x-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">{t('grades.fields.student')}</TableHead>
                    {uniqueAssessments.slice(0, 5).map(assessment => (
                      <TableHead key={assessment} className="text-center min-w-[120px]">{assessment}</TableHead>
                    ))}
                    <TableHead className="text-center min-w-[100px]">{t('grades.averageLabel')}</TableHead>
                    <TableHead className="text-center min-w-[80px]">{t('grades.gradeLabel')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradebookVirtualizer.getVirtualItems().map((virtualRow) => {
                    const entry = gradebook[virtualRow.index];
                    return (
                      <TableRow
                        key={entry.student_id}
                        className="absolute w-full"
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
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
                              <span className="text-ink/40">-</span>
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-ink font-display">{t('grades.gradeList')}</h2>
          </div>
          {filteredGrades.length === 0 ? (
            <EmptyState icon={GraduationCap} message={t('grades.noGradesMatch')} />
          ) : (
            <div ref={listScrollRef} className="overflow-auto max-h-[600px]">
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
                {listVirtualizer.getVirtualItems().map((virtualRow) => {
                  const grade = filteredGrades[virtualRow.index];
                  return (
                    <TableRow
                      key={grade.id}
                      className="absolute w-full"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-surface-cool text-ink/60">
                              {grade.student?.name?.split(' ')[0]?.charAt(0)}
                              {grade.student?.name?.split(' ')[1]?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{grade.student?.name || 'Unknown'}</div>
                            <div className="text-sm text-ink/60">{grade.student?.grade_level}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{grade.subject}</Badge></TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{grade.assessment_name}</div>
                          <div className="text-sm text-ink/60 capitalize">{grade.assessment_type}</div>
                        </div>
                      </TableCell>
                      <TableCell><span className="font-medium">{grade.score}/{grade.max_score}</span></TableCell>
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
                          {new Date(grade.date).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditGrade(grade)} title={t('common.edit')}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteGrade(grade)} className="text-[#c53030] hover:text-[#c53030]/80" title={t('common.delete')}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      )}

      {/* Edit Grade Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('grades.editGradeTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateGrade} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_score">{t('grades.fields.score')} *</Label>
                <Input id="edit_score" type="number" min="0" step="0.5" value={newGrade.score} onChange={(e) => setNewGrade(s => ({ ...s, score: parseFloat(e.target.value) || 0 }))} required />
              </div>
              <div>
                <Label htmlFor="edit_max_score">{t('grades.fields.maxScore')} *</Label>
                <Input id="edit_max_score" type="number" min="1" value={newGrade.max_score} onChange={(e) => setNewGrade(s => ({ ...s, max_score: parseFloat(e.target.value) || 100 }))} required />
              </div>
            </div>
            <div>
              <Label htmlFor="edit_notes">{t('grades.fields.notes')}</Label>
              <textarea id="edit_notes" className="w-full border rounded px-3 py-2" rows={3} value={newGrade.notes} onChange={(e) => setNewGrade(s => ({ ...s, notes: e.target.value }))} placeholder={t('grades.notesPlaceholder')} />
            </div>
            {formError && (
              <div className="text-[#c53030] text-sm bg-[#c53030]/10 p-3 rounded">{formError}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)} disabled={submitting}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={submitting}>{submitting ? t('grades.saving') : t('common.save')}</Button>
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
