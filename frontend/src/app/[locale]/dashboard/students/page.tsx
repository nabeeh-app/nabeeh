'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Edit, Trash2, Eye, Download, Upload, Users, GraduationCap, Phone, Calendar, MapPin, BookOpen, Link2 } from 'lucide-react';
import { Student, CreateStudentRequest, Parent } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatCards } from '@/components/ui/StatCards';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { useStudents, useCreateStudent, useUpdateStudent, useDeleteStudent } from '@/hooks/useStudents';
import { useOfferings } from '@/hooks/useOfferings';
import StudentImportModal from '@/components/students/StudentImportModal';
import SelfRegistrationLink from '@/components/students/SelfRegistrationLink';

interface StudentWithParents extends Student {
  parents: Parent[];
}

const PAGE_SIZE = 20;

export default function StudentsPage() {
  const t = useTranslations();
  const locale = useLocale();

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
      setFormError(t('students.validation.fillRequired'));
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
      setFormError(t('students.validation.selectClass'));
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
      title: t('common.delete'),
      description: t('students.deleteConfirm'),
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteStudent.mutateAsync(student.id);
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

  const getStatusBadge = (status: string) => {
    const statusMap = {
      active: {
        variant: 'default' as const,
        label: t('students.status.active'),
        color: 'bg-surface-sage text-ink'
      },
      inactive: {
        variant: 'secondary' as const,
        label: t('students.status.inactive'),
        color: 'bg-surface-cool text-ink/70'
      },
      graduated: {
        variant: 'outline' as const,
        label: t('students.status.graduated'),
        color: 'bg-primary/10 text-primary'
      }
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.active;
  };

  const uniqueGrades = [...new Set(students.map(s => s.grade_level))].filter(Boolean);

  if (isLoading) {
    return <LoadingSpinner message={t('students.loading')} />;
  }

  const stats = [
    { icon: Users, value: studentsResponse?.pagination?.total ?? students.length, label: t('students.totalStudents'), color: 'primary' as const },
    { icon: GraduationCap, value: students.filter(s => s.status === 'active').length, label: t('students.activeStudents'), color: 'success' as const },
    { icon: BookOpen, value: uniqueGrades.length, label: t('students.fields.gradeLevel'), color: 'accent' as const },
    { icon: Calendar, value: students.filter(s => { const d = new Date(s.enrollment_date); const m = new Date(); m.setMonth(m.getMonth() - 1); return d >= m; }).length, label: t('students.newThisMonth'), color: 'warning' as const },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('students.title')}
        description={t('students.descriptionCount', { count: studentsResponse?.pagination?.total ?? students.length })}
      >
        <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          {t('common.import')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSelfRegModalOpen(true)}>
          <Link2 className="w-4 h-4 mr-2" />
          {t('students.selfRegister')}
        </Button>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          {t('common.export')}
        </Button>
        <Dialog open={isAddModalOpen} onOpenChange={setAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t('students.addStudent')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {t('students.addStudent')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="student_id">
                    {t('students.fields.studentId')} *
                  </Label>
                  <Input
                    id="student_id"
                    value={newStudent.student_id}
                    onChange={(e) => setNewStudent(s => ({ ...s, student_id: e.target.value }))}
                    placeholder={t('students.studentIdPlaceholder')}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">
                    {t('students.fields.name')} *
                  </Label>
                  <Input
                    id="name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent(s => ({ ...s, name: e.target.value }))}
                    placeholder={t('students.fullNamePlaceholder')}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="group_id">
                    {t('students.fields.group')} *
                  </Label>
                  <Select
                    value={newStudent.group_id}
                    onValueChange={(groupId) => {
                      const offering = offerings.find(o => o.groups.some((g) => g.id === groupId));
                      setNewStudent(s => ({
                        ...s,
                        group_id: groupId,
                        grade_level: offering?.grade_level?.name || s.grade_level
                      }));
                    }}
                  >
                    <SelectTrigger id="group_id">
                      <SelectValue placeholder={t('students.selectClass')} />
                    </SelectTrigger>
                    <SelectContent>
                      {offerings.flatMap(o => o.groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {o.subject.name_en} - {g.name}
                        </SelectItem>
                      )))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="grade_level">
                    {t('students.fields.gradeLevel')} *
                  </Label>
                  <Input
                    id="grade_level"
                    value={newStudent.grade_level}
                    onChange={(e) => setNewStudent(s => ({ ...s, grade_level: e.target.value }))}
                    placeholder={t('students.gradeLevelPlaceholder')}
                    required
                    readOnly
                    className="bg-surface-cool"
                  />
                </div>
                <div>
                  <Label htmlFor="date_of_birth">
                    {t('students.fields.dateOfBirth')}
                  </Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={newStudent.date_of_birth}
                    onChange={(e) => setNewStudent(s => ({ ...s, date_of_birth: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="gender">
                    {t('students.fields.gender')}
                  </Label>
                  <Select
                    value={newStudent.gender}
                    onValueChange={(value) => setNewStudent(s => ({ ...s, gender: value }))}
                  >
                    <SelectTrigger id="gender">
                      <SelectValue placeholder={t('students.selectGender')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t('students.gender.male')}</SelectItem>
                      <SelectItem value="female">{t('students.gender.female')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="emergency_contact">
                    {t('students.fields.emergencyContact')}
                  </Label>
                  <Input
                    id="emergency_contact"
                    dir="ltr"
                    className="text-left"
                    value={newStudent.emergency_contact}
                    onChange={(e) => setNewStudent(s => ({ ...s, emergency_contact: e.target.value }))}
                    placeholder="+966xxxxxxxxx"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="subjects">
                  {t('students.fields.subjects')}
                </Label>
                <Input
                  id="subjects"
                  value={Array.isArray(newStudent.subjects) ? newStudent.subjects.join(', ') : ''}
                  onChange={(e) => setNewStudent(s => ({
                    ...s,
                    subjects: e.target.value.split(',').map(subject => subject.trim()).filter(Boolean)
                  }))}
                  placeholder={t('students.subjectsPlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="address">
                  {t('students.fields.address')}
                </Label>
                <Input
                  id="address"
                  value={newStudent.address}
                  onChange={(e) => setNewStudent(s => ({ ...s, address: e.target.value }))}
                  placeholder={t('students.addressPlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="notes">
                  {t('students.fields.notes')}
                </Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={newStudent.notes}
                  onChange={(e) => setNewStudent(s => ({ ...s, notes: e.target.value }))}
                  placeholder={t('students.notesPlaceholder')}
                />
              </div>
              {formError && (
                <div className="text-[#c53030] text-sm bg-[#c53030]/10 p-3 rounded">
                  {formError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddModalOpen(false)}
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? t('common.saving')
                    : t('common.save')
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <StatCards stats={stats} />

      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('students.searchPlaceholderShort')}
        resultCount={filteredStudents.length}
        totalCount={students.length}
        resultLabel={t('students.resultLabel', { filtered: filteredStudents.length, total: students.length })}
      >
        <Select
          value={selectedGroupId}
          onValueChange={(v) => { setSelectedGroupId(v); setPage(1); }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('students.allClasses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('students.allClasses')}</SelectItem>
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
            <SelectValue placeholder={t('students.allStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('students.allStatus')}</SelectItem>
            <SelectItem value="active">{t('students.status.active')}</SelectItem>
            <SelectItem value="inactive">{t('students.status.inactive')}</SelectItem>
            <SelectItem value="graduated">{t('students.status.graduated')}</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="space-y-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-ink font-display">
            {t('students.studentList')}
          </h2>
        </div>
        {filteredStudents.length === 0 ? (
          <EmptyState
            icon={Users}
            message={
              searchTerm || statusFilter !== 'all' || gradeFilter !== 'all'
                ? t('students.noStudentsMatch')
                : t('students.noStudentsYet')
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('students.student')}</TableHead>
                  <TableHead>{t('students.details')}</TableHead>
                  <TableHead>{t('students.fields.subjects')}</TableHead>
                  <TableHead>{t('students.fields.status')}</TableHead>
                  <TableHead>{t('students.enrollment')}</TableHead>
                  <TableHead>{t('students.actionsColumn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => {
                  const status = getStatusBadge(student.status);
                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {student.name.split(' ')[0].charAt(0)}
                              {student.name.split(' ')[1]?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{student.name}</div>
                            <div className="text-sm text-ink/60">ID: {student.student_id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3 text-ink/40" />
                            <span>{student.grade_level}</span>
                          </div>
                          {student.emergency_contact && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-ink/40" />
                              <span className="text-ink/60">{student.emergency_contact}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {student.subjects?.slice(0, 2).map((subject, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {subject}
                            </Badge>
                          ))}
                          {student.subjects && student.subjects.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{student.subjects.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className={status.color}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(student.enrollment_date).toLocaleDateString(
                            locale === 'ar' ? 'ar-SA' : 'en-US'
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewStudent(student)}
                            aria-label={t('students.viewDetails')}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStudent(student)}
                            aria-label={t('common.edit')}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStudent(student)}
                            className="text-destructive hover:text-destructive/80"
                            aria-label={t('common.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* View Student Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogClose asChild>
            <button
              className="absolute top-4 ltr:right-4 rtl:left-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label={t('common.close')}
            >
              <span className="sr-only">{t('common.close')}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </DialogClose>

          <DialogHeader>
            <DialogTitle>
              {t('students.studentDetails')}
            </DialogTitle>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {selectedStudent.name.split(' ')[0].charAt(0)}
                    {selectedStudent.name.split(' ')[1]?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-semibold truncate">{selectedStudent.name}</h3>
                    <Badge variant={getStatusBadge(selectedStudent.status).variant} className="shrink-0">
                      {getStatusBadge(selectedStudent.status).label}
                    </Badge>
                  </div>
                  <p className="text-sm text-ink/60 mt-0.5" dir="ltr" style={{ direction: 'ltr' }}>
                    ID: {selectedStudent.student_id}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-ink/80 border-b border-ink/10 pb-1.5">
                    {t('students.basicInfo')}
                  </h4>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center gap-2.5">
                      <GraduationCap className="h-4 w-4 text-ink/40 shrink-0" />
                      <span>{selectedStudent.grade_level}</span>
                    </div>
                    {selectedStudent.date_of_birth && (
                      <div className="flex items-center gap-2.5">
                        <Calendar className="h-4 w-4 text-ink/40 shrink-0" />
                        <span>
                          {new Date(selectedStudent.date_of_birth).toLocaleDateString(
                            locale === 'ar' ? 'ar-SA' : 'en-US'
                          )}
                        </span>
                      </div>
                    )}
                    {selectedStudent.gender && (
                      <div className="flex items-center gap-2.5">
                        <span className="text-ink/40">·</span>
                        <span>
                          <span className="text-ink/60">{t('students.genderLabel')}</span>{' '}
                          {selectedStudent.gender === 'male'
                            ? t('students.gender.male')
                            : t('students.gender.female')
                          }
                        </span>
                      </div>
                    )}
                    {selectedStudent.address && (
                      <div className="flex items-center gap-2.5">
                        <MapPin className="h-4 w-4 text-ink/40 shrink-0" />
                        <span>{selectedStudent.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-ink/80 border-b border-ink/10 pb-1.5">
                    {t('students.contactInfo')}
                  </h4>
                  <div className="space-y-2.5 text-sm">
                    {selectedStudent.emergency_contact && (
                      <div className="flex items-center gap-2.5">
                        <Phone className="h-4 w-4 text-ink/40 shrink-0" />
                        <span dir="ltr" style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>
                          {selectedStudent.emergency_contact}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5">
                      <Calendar className="h-4 w-4 text-ink/40 shrink-0" />
                      <span>
                        <span className="text-ink/60">{t('students.enrollmentDateLabel')}:</span>{' '}
                        {new Date(selectedStudent.enrollment_date).toLocaleDateString(
                          locale === 'ar' ? 'ar-SA' : 'en-US'
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedStudent.subjects && selectedStudent.subjects.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-ink/80 border-b border-ink/10 pb-1.5">
                    {t('students.fields.subjects')}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedStudent.subjects.map((subject, index) => (
                      <Badge key={index} variant="outline">
                        {subject}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedStudent.parents && selectedStudent.parents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-ink/80 border-b border-ink/10 pb-1.5">
                    {t('students.parentsGuardians')}
                  </h4>
                  <div className="space-y-2">
                    {selectedStudent.parents.map((parent) => (
                      <div key={parent.id} className="flex items-center justify-between p-3 bg-surface-cool rounded gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{parent.name}</div>
                          <div className="text-sm text-ink/60" dir="ltr" style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>
                            {parent.phone}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-ink/60">{parent.relationship}</span>
                          {parent.is_primary && (
                            <Badge variant="outline" className="text-xs">
                              {t('students.primary')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedStudent.notes && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-ink/80 border-b border-ink/10 pb-1.5">
                    {t('students.fields.notes')}
                  </h4>
                  <p className="text-sm text-ink/60 bg-surface-cool p-3 rounded">
                    {selectedStudent.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Student Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('students.editStudent')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateStudent} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_student_id">
                  {t('students.fields.studentId')} *
                </Label>
                <Input
                  id="edit_student_id"
                  value={newStudent.student_id}
                  onChange={(e) => setNewStudent(s => ({ ...s, student_id: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_name">
                  {t('students.fields.name')} *
                </Label>
                <Input
                  id="edit_name"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent(s => ({ ...s, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_group_id">
                  {t('students.fields.group')} *
                </Label>
                <Select
                  value={newStudent.group_id}
                  onValueChange={(groupId) => {
                    const offering = offerings.find(o => o.groups.some((g) => g.id === groupId));
                    setNewStudent(s => ({
                      ...s,
                      group_id: groupId,
                      grade_level: offering?.grade_level?.name || s.grade_level
                    }));
                  }}
                >
                  <SelectTrigger id="edit_group_id">
                    <SelectValue placeholder={t('students.selectClass')} />
                  </SelectTrigger>
                  <SelectContent>
                    {offerings.flatMap(o => o.groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {o.subject.name_en} - {g.name}
                      </SelectItem>
                    )))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_grade_level">
                  {t('students.fields.gradeLevel')} *
                </Label>
                <Input
                  id="edit_grade_level"
                  value={newStudent.grade_level}
                  onChange={(e) => setNewStudent(s => ({ ...s, grade_level: e.target.value }))}
                  required
                  readOnly
                  className="bg-surface-cool"
                />
              </div>
              <div>
                <Label htmlFor="edit_status">
                  {t('students.fields.status')}
                </Label>
                <Select
                  value={newStudent.status}
                  onValueChange={(value) => setNewStudent(s => ({ ...s, status: value as 'active' | 'inactive' | 'graduated' }))}
                >
                  <SelectTrigger id="edit_status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('students.status.active')}</SelectItem>
                    <SelectItem value="inactive">{t('students.status.inactive')}</SelectItem>
                    <SelectItem value="graduated">{t('students.status.graduated')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formError && (
              <div className="text-[#c53030] text-sm bg-[#c53030]/10 p-3 rounded">
                {formError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
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
                  ? t('common.saving')
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
            <DialogTitle>{t('students.selfRegister')}</DialogTitle>
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
