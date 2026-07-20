'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Download, Upload, Users, GraduationCap, Calendar, BookOpen, Link2 } from 'lucide-react';
import { Student, CreateStudentRequest, Parent } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatCards } from '@/components/ui/StatCards';
import { FilterBar } from '@/components/ui/FilterBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStudents, useCreateStudent, useUpdateStudent, useDeleteStudent } from '@/hooks/useStudents';
import { getStatusBadge } from '@/lib/utils';
import { useOfferings } from '@/hooks/useOfferings';
import StudentImportModal from '@/components/students/StudentImportModal';
import SelfRegistrationLink from '@/components/students/SelfRegistrationLink';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StudentListTable from '@/components/dashboard/students/StudentListTable';
import StudentDetailSidebar from '@/components/dashboard/students/StudentDetailSidebar';
import StudentFormModal from '@/components/dashboard/students/StudentFormModal';

interface StudentWithParents extends Student {
  parents: Parent[];
}

const PAGE_SIZE = 20;

export default function StudentsPage() {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const tRoot = useTranslations();
  const statusBadge = (status: string) => getStatusBadge(status, locale as 'en' | 'ar', tRoot);

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gradeFilter] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isSelfRegModalOpen, setSelfRegModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithParents | null>(null);
  const [isViewModalOpen, setViewModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  const { data: offerings = [] } = useOfferings();

  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (selectedGroupId && selectedGroupId !== 'all') {
      params.group_id = selectedGroupId;
    }
    return params;
  }, [page, selectedGroupId]);

  const { data: studentsResponse, isLoading } = useStudents(queryParams);
  const students: StudentWithParents[] = useMemo(() => {
    return (studentsResponse?.data ?? []).map((s: Student) => ({
      ...s,
      parents: s.parents ?? [],
    }));
  }, [studentsResponse]);

  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();

  const [newStudent, setNewStudent] = useState<CreateStudentRequest>({
    student_id: '',
    name: '',
    grade_level: '',
    group_id: '',
    date_of_birth: '',
    gender: '',
    subjects: [],
    enrollment_date: new Date().toISOString().split('T')[0],
    status: 'active',
    notes: '',
    emergency_contact: '',
    address: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [alertDialog, setAlertDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive';
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.subjects?.some(subject =>
          subject.toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
      const matchesGrade = gradeFilter === 'all' || student.grade_level === gradeFilter;
      return matchesSearch && matchesStatus && matchesGrade;
    });
  }, [students, searchTerm, statusFilter, gradeFilter]);

  const totalPages = studentsResponse?.pagination?.total
    ? Math.ceil(studentsResponse.pagination.total / PAGE_SIZE)
    : 1;

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newStudent.name || !newStudent.grade_level || !newStudent.student_id || !newStudent.group_id) {
      setFormError(t('validation.fillRequired'));
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      await createStudent.mutateAsync(newStudent);
      setAddModalOpen(false);
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message || 'Failed to create student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewStudent = (student: StudentWithParents) => {
    setSelectedStudent(student);
    setViewModalOpen(true);
  };

  const handleEditStudent = (student: StudentWithParents) => {
    setSelectedStudent(student);
    setNewStudent({
      student_id: student.student_id,
      name: student.name,
      grade_level: student.grade_level,
      group_id: student.group_id || '',
      date_of_birth: student.date_of_birth || '',
      gender: student.gender || '',
      subjects: student.subjects || [],
      enrollment_date: student.enrollment_date,
      status: student.status,
      notes: student.notes || '',
      emergency_contact: student.emergency_contact || '',
      address: student.address || '',
    });
    setEditModalOpen(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!newStudent.group_id) {
      setFormError(t('validation.selectClass'));
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      await updateStudent.mutateAsync({ id: selectedStudent.id, data: newStudent });
      setEditModalOpen(false);
      setSelectedStudent(null);
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message || 'Failed to update student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async (student: StudentWithParents) => {
    setAlertDialog({
      open: true,
      title: tCommon('delete'),
      description: t('deleteConfirm'),
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteStudent.mutateAsync(student.id);
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
    setNewStudent({
      student_id: '',
      name: '',
      group_id: selectedGroupId !== 'all' ? selectedGroupId : '',
      grade_level: '',
      date_of_birth: '',
      gender: '',
      subjects: [],
      enrollment_date: new Date().toISOString().split('T')[0],
      status: 'active',
      notes: '',
      emergency_contact: '',
      address: '',
    });
    setFormError('');
  };

  const uniqueGrades = [...new Set(students.map(s => s.grade_level))].filter(Boolean);

  if (isLoading) {
    return <LoadingSpinner message={t('loading')} />;
  }

  const stats = [
    { icon: Users, value: studentsResponse?.pagination?.total ?? students.length, label: t('totalStudents'), color: 'primary' as const },
    { icon: GraduationCap, value: students.filter(s => s.status === 'active').length, label: t('activeStudents'), color: 'success' as const },
    { icon: BookOpen, value: uniqueGrades.length, label: t('fields.gradeLevel'), color: 'accent' as const },
    { icon: Calendar, value: students.filter(s => { const d = new Date(s.enrollment_date); const m = new Date(); m.setMonth(m.getMonth() - 1); return d >= m; }).length, label: t('newThisMonth'), color: 'warning' as const },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('descriptionCount', { count: studentsResponse?.pagination?.total ?? students.length })}
      >
        <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          {tCommon('import')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSelfRegModalOpen(true)}>
          <Link2 className="w-4 h-4 mr-2" />
          {t('selfRegister')}
        </Button>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          {tCommon('export')}
        </Button>
        <Button className="gap-2" onClick={() => setAddModalOpen(true)}>
          <Plus className="w-4 h-4" />
          {t('addStudent')}
        </Button>
      </PageHeader>

      <StatCards stats={stats} />

      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('searchPlaceholderShort')}
        resultCount={filteredStudents.length}
        totalCount={students.length}
        resultLabel={t('resultLabel', { filtered: filteredStudents.length, total: students.length })}
      >
        <Select
          value={selectedGroupId}
          onValueChange={(v) => { setSelectedGroupId(v); setPage(1); }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('allClasses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allClasses')}</SelectItem>
            {offerings.flatMap(o => o.groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {o.subject.name_en} - {g.name}
              </SelectItem>
            )))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('allStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatus')}</SelectItem>
            <SelectItem value="active">{t('status.active')}</SelectItem>
            <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
            <SelectItem value="graduated">{t('status.graduated')}</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="space-y-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-ink font-display">
            {t('studentList')}
          </h2>
        </div>
        <StudentListTable
          students={filteredStudents}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          gradeFilter={gradeFilter}
          onView={handleViewStudent}
          onEdit={handleEditStudent}
          onDelete={handleDeleteStudent}
          getStatusBadge={statusBadge}
        />
      </div>

      <StudentDetailSidebar
        student={selectedStudent}
        open={isViewModalOpen}
        onOpenChange={setViewModalOpen}
        getStatusBadge={statusBadge}
      />

      <StudentFormModal
        open={isEditModalOpen}
        onOpenChange={setEditModalOpen}
        mode="edit"
        student={newStudent}
        onStudentChange={setNewStudent}
        offerings={offerings}
        formError={formError}
        submitting={submitting}
        onSubmit={handleUpdateStudent}
        onCancel={() => setEditModalOpen(false)}
      />

      <StudentFormModal
        open={isAddModalOpen}
        onOpenChange={setAddModalOpen}
        mode="add"
        student={newStudent}
        onStudentChange={setNewStudent}
        offerings={offerings}
        formError={formError}
        submitting={submitting}
        onSubmit={handleAddStudent}
        onCancel={() => setAddModalOpen(false)}
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

      <StudentImportModal
        open={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
        onComplete={() => {
          setImportModalOpen(false);
        }}
      />

      <Dialog open={isSelfRegModalOpen} onOpenChange={setSelfRegModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('selfRegister')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-ink)]/60">
              Generate a registration link for a group. Students can use this link to register themselves.
            </p>
            {selectedGroupId && selectedGroupId !== 'all' ? (
              <SelfRegistrationLink
                groupId={selectedGroupId}
              />
            ) : (
              <div className="text-sm text-[var(--color-ink)]/60">
                Please select a specific group first using the filter above.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
