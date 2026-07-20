'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Plus,
  GraduationCap,
  BookOpen,
  Calculator,
  Download,
  Upload,
  BarChart3,
  FileSpreadsheet,
  Award
} from 'lucide-react';
import { Student, Grade, CreateGradeRequest } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCards } from '@/components/ui/StatCards';
import { ViewModeTabs } from '@/components/ui/ViewModeTabs';
import { useOfferings } from '@/hooks/useOfferings';
import { useStudents } from '@/hooks/useStudents';
import { useGrades, useCreateGrade, useUpdateGrade, useDeleteGrade } from '@/hooks/useGrades';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import GradebookTable from '@/components/dashboard/grades/GradebookTable';
import GradeListTable from '@/components/dashboard/grades/GradeListTable';
import GradeFormModal from '@/components/dashboard/grades/GradeFormModal';
import GradeStatsModal from '@/components/dashboard/grades/GradeStatsModal';

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
  if (percentage >= 85) return 'text-primary bg-surface-sage';
  if (percentage >= 70) return 'text-ink/70 bg-surface-cool';
  return 'text-destructive bg-destructive/10';
};

export default function GradesPage() {
  const t = useTranslations('grades');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tStudents = useTranslations('students');
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

  const { data: offerings = [], isLoading: offeringsLoading } = useOfferings();

  const groups = offerings.flatMap(o => o.groups ?? []);

  useEffect(() => {
    if (groups.length === 0 && !offeringsLoading) {
      router.replace(`/${locale}/dashboard/classes?setup=required`);
    }
  }, [groups, offeringsLoading, locale, router]);

  const effectiveSelectedGroupId = selectedGroupId || groups[0]?.id || '';

  const currentSubjectName = (() => {
    for (const offering of offerings) {
      if (offering.groups.find((g) => g.id === effectiveSelectedGroupId)) {
        return offering.subject.name_en;
      }
    }
    return '';
  })();

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
  } : undefined, [effectiveSelectedGroupId, dateRange.from, dateRange.to, currentSubjectName]);

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

  const gradebook: GradebookEntry[] = useMemo(() => students.map(student => {
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
  }), [students, grades]);

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
      setFormError(t('validation.fillRequired'));
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
      setFormError(message || t('createError'));
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
      setFormError(t('validation.selectClass'));
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
      setFormError(message || t('updateError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGrade = async (grade: GradeWithStudent) => {
    setAlertDialog({
      open: true,
      title: tCommon('delete'),
      description: t('deleteConfirm'),
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteGrade.mutateAsync(grade.id);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          setAlertDialog({
            open: true,
            title: tErrors('generic'),
            description: message || tErrors('generic'),
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

  const uniqueSubjects = [...new Set(grades.map(g => g.subject))];
  const uniqueAssessments = [...new Set(grades.map(g => g.assessment_name))];

  const filteredGrades = useMemo(() => grades.filter(grade => {
    const matchesSearch = grade.student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grade.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grade.assessment_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAssessmentType = selectedAssessmentType === 'all' || grade.assessment_type === selectedAssessmentType;
    const matchesGradeFilter = gradeFilter === 'all' || getLetterGrade(grade.percentage) === gradeFilter;
    return matchesSearch && matchesAssessmentType && matchesGradeFilter;
  }), [grades, searchTerm, selectedAssessmentType, gradeFilter]);

  const isLoading = offeringsLoading || studentsLoading || gradesLoading;

  if (isLoading) {
    return <LoadingSpinner message={t('loading')} />;
  }

  if (groups.length === 0) {
    return <EmptyState icon={BarChart3} message={t('noGroups')} description={t('noGroupsDescription')} actionLabel={t('setUpGroups')} onAction={() => router.push(`/${locale}/dashboard/classes?setup=required`)} />;
  }

  const stats = [
    { icon: GraduationCap, value: grades.length, label: t('totalGrades'), color: 'primary' as const },
    { icon: BookOpen, value: uniqueSubjects.length, label: t('subjectsLabel'), color: 'success' as const },
    { icon: Calculator, value: grades.length > 0 ? (grades.reduce((sum, g) => sum + g.percentage, 0) / grades.length).toFixed(1) + '%' : '0%', label: t('overallAverage'), color: 'accent' as const },
    { icon: Award, value: grades.filter(g => g.percentage >= 90).length, label: t('excellentGrades'), color: 'warning' as const },
  ];

  const viewModes = [
    { id: 'gradebook', label: t('gradebook'), icon: FileSpreadsheet },
    { id: 'list', label: t('gradeList'), icon: GraduationCap },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('descriptionCount')}
      >
        <Select value={effectiveSelectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder={tStudents('fields.group')} />
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
          <Download className="w-4 h-4 ms-2" />
          {tCommon('export')}
        </Button>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 ms-2" />
          {tCommon('import')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStatsModalOpen(true)}>
          <BarChart3 className="w-4 h-4 ms-2" />
          {t('gradeStatistics')}
        </Button>
        <Button className="gap-2" onClick={() => setAddGradeModalOpen(true)} disabled={!selectedGroupId}>
          <Plus className="w-4 h-4" />
          {t('addGrade')}
        </Button>
      </PageHeader>

      <StatCards stats={stats} />

      <div className="flex items-center justify-between">
        <ViewModeTabs
          modes={viewModes}
          active={viewMode}
          onChange={(mode) => setViewMode(mode as 'gradebook' | 'list')}
        />
        <div className="flex items-center gap-2">
          <Input placeholder={t('searchEllipsis')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-64" />
        </div>
      </div>

      {viewMode === 'gradebook' && (
        <GradebookTable
          gradebook={gradebook}
          uniqueAssessments={uniqueAssessments}
          currentSubjectName={currentSubjectName}
          getGradeColor={getGradeColor}
        />
      )}

      {viewMode === 'list' && (
        <GradeListTable
          grades={filteredGrades}
          onEdit={handleEditGrade}
          onDelete={handleDeleteGrade}
          getGradeColor={getGradeColor}
          getLetterGrade={getLetterGrade}
        />
      )}

      <GradeFormModal
        open={isEditModalOpen}
        onOpenChange={setEditModalOpen}
        mode="edit"
        grade={newGrade}
        onGradeChange={setNewGrade}
        students={students}
        currentSubjectName={currentSubjectName}
        formError={formError}
        submitting={submitting}
        onSubmit={handleUpdateGrade}
        onCancel={() => setEditModalOpen(false)}
      />

      <GradeFormModal
        open={isAddGradeModalOpen}
        onOpenChange={setAddGradeModalOpen}
        mode="add"
        grade={newGrade}
        onGradeChange={setNewGrade}
        students={students}
        currentSubjectName={currentSubjectName}
        formError={formError}
        submitting={submitting}
        onSubmit={handleAddGrade}
        onCancel={() => setAddGradeModalOpen(false)}
      />

      <GradeStatsModal
        open={isStatsModalOpen}
        onOpenChange={setStatsModalOpen}
        subjectStats={subjectStats}
      />

      <ConfirmDialog
        open={alertDialog.open}
        onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}
        title={alertDialog.title}
        description={alertDialog.description}
        onConfirm={alertDialog.onConfirm}
        variant={alertDialog.variant}
        cancelLabel={tCommon('cancel')}
        confirmLabel={tCommon('confirm')}
      />
    </div>
  );
}
