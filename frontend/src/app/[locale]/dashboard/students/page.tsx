'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import logger from '@/lib/logger';
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
  Search,
  Edit,
  Trash2,
  Eye,
  Download,
  Upload,
  Users,
  GraduationCap,
  Phone,
  Calendar,
  MapPin,
  BookOpen
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Student, CreateStudentRequest, Parent, Offering } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatCards } from '@/components/ui/StatCards';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';

interface StudentWithParents extends Student {
  parents: Parent[];
}

export default function StudentsPage() {
  const t = useTranslations();
  const locale = useLocale();

  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<StudentWithParents[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentWithParents[]>([]);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithParents | null>(null);
  const [isViewModalOpen, setViewModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

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
    loadStudents();
  }, [selectedGroupId]);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, statusFilter, gradeFilter]);

  const loadOfferings = async () => {
    try {
      const data = await apiClient.getOfferings();
      setOfferings(data);
    } catch (err) {
      logger.error('Failed checking offerings', err);
    }
  };

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = { limit: 100 };
      if (selectedGroupId && selectedGroupId !== 'all') {
        params.group_id = selectedGroupId;
      }

      const response = await apiClient.getStudents(params);

      const studentsWithParents = response.data.map(student => ({
        ...student,
        parents: student.parents || []
      }));

      setStudents(studentsWithParents);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load students';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = students.filter(student => {
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

    setFilteredStudents(filtered);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newStudent.name || !newStudent.grade_level || !newStudent.student_id || !newStudent.group_id) {
      setFormError(t('students.validation.fillRequired'));
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const createdStudent = await apiClient.createStudent(newStudent);

      const studentWithParents: StudentWithParents = {
        ...createdStudent,
        parents: []
      };

      setStudents(prev => [...prev, studentWithParents]);
      setAddModalOpen(false);
      resetForm();

    } catch (err: any) {
      logger.error('Error creating student:', err);
      setFormError(err.message || 'Failed to create student');
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

      const updatedStudent = await apiClient.updateStudent(selectedStudent.id, newStudent);

      setStudents(prev =>
        prev.map(s => s.id === selectedStudent.id
          ? { ...updatedStudent, parents: s.parents }
          : s
        )
      );

      setEditModalOpen(false);
      setSelectedStudent(null);
      resetForm();

    } catch (err: any) {
      logger.error('Error updating student:', err);
      setFormError(err.message || 'Failed to update student');
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
          await apiClient.deleteStudent(student.id);
          setStudents(prev => prev.filter(s => s.id !== student.id));
        } catch (err: any) {
          logger.error('Error deleting student:', err);
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
        color: 'bg-green-100 text-green-800'
      },
      inactive: {
        variant: 'secondary' as const,
        label: t('students.status.inactive'),
        color: 'bg-gray-100 text-gray-800'
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

  if (loading) {
    return <LoadingSpinner message={t('students.loading')} />;
  }

  const stats = [
    { icon: Users, value: students.length, label: t('students.totalStudents'), color: 'primary' as const },
    { icon: GraduationCap, value: students.filter(s => s.status === 'active').length, label: t('students.activeStudents'), color: 'success' as const },
    { icon: BookOpen, value: uniqueGrades.length, label: t('students.fields.gradeLevel'), color: 'accent' as const },
    { icon: Calendar, value: students.filter(s => { const d = new Date(s.enrollment_date); const m = new Date(); m.setMonth(m.getMonth() - 1); return d >= m; }).length, label: t('students.newThisMonth'), color: 'warning' as const },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('students.title')}
        description={t('students.descriptionCount', { count: students.length })}
      >
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          {t('common.import')}
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
                    placeholder={locale === 'ar' ? 'مثال: ST001' : 'e.g., ST001'}
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
                    placeholder={locale === 'ar' ? 'الاسم الكامل' : 'Full name'}
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
                    placeholder={locale === 'ar' ? 'مثال: الصف العاشر' : 'e.g., Grade 10'}
                    required
                    readOnly
                    className="bg-gray-50"
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
                    value={newStudent.emergency_contact}
                    onChange={(e) => setNewStudent(s => ({ ...s, emergency_contact: e.target.value }))}
                    placeholder={locale === 'ar' ? '+966xxxxxxxxx' : '+966xxxxxxxxx'}
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
                  placeholder={locale === 'ar' ? 'الرياضيات، الفيزياء، الكيمياء' : 'Mathematics, Physics, Chemistry'}
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
                  placeholder={locale === 'ar' ? 'العنوان الكامل' : 'Full address'}
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
                  placeholder={locale === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'}
                />
              </div>
              {formError && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded">
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
        resultLabel={locale === 'ar' ? `عرض ${filteredStudents.length} من ${students.length} طالب` : `Showing ${filteredStudents.length} of ${students.length} students`}
      >
        <Select
          value={selectedGroupId}
          onValueChange={setSelectedGroupId}
        >
          <SelectTrigger className="min-w-[200px]">
            <SelectValue placeholder={t('students.allClasses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('students.allClasses')}</SelectItem>
            {offerings.flatMap(o => o.groups.map((g: any) => (
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
          <SelectTrigger className="min-w-[150px]">
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

      <Card>
        <CardHeader>
          <CardTitle>
            {t('students.studentList')}
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                    <TableRow key={student.id} className="hover:bg-gray-50">
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
                            <div className="text-sm text-gray-500">ID: {student.student_id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3 text-gray-400" />
                            <span>{student.grade_level}</span>
                          </div>
                          {student.emergency_contact && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-gray-400" />
                              <span className="text-gray-600">{student.emergency_contact}</span>
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
          )}
        </CardContent>
      </Card>

      {/* View Student Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('students.studentDetails')}
            </DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {selectedStudent.name.split(' ')[0].charAt(0)}
                    {selectedStudent.name.split(' ')[1]?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedStudent.name}</h3>
                  <p className="text-gray-600">ID: {selectedStudent.student_id}</p>
                  <Badge variant={getStatusBadge(selectedStudent.status).variant}>
                    {getStatusBadge(selectedStudent.status).label}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">
                    {t('students.basicInfo')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-gray-400" />
                      <span>{selectedStudent.grade_level}</span>
                    </div>
                    {selectedStudent.date_of_birth && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>
                          {new Date(selectedStudent.date_of_birth).toLocaleDateString(
                            locale === 'ar' ? 'ar-SA' : 'en-US'
                          )}
                        </span>
                      </div>
                    )}
                    {selectedStudent.gender && (
                      <div>
                        <strong>{t('students.genderLabel')}</strong> {
                          selectedStudent.gender === 'male'
                            ? t('students.gender.male')
                            : t('students.gender.female')
                        }
                      </div>
                    )}
                    {selectedStudent.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>{selectedStudent.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">
                    {t('students.contactInfo')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selectedStudent.emergency_contact && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{selectedStudent.emergency_contact}</span>
                      </div>
                    )}
                    <div>
                      <strong>{t('students.enrollmentDateLabel')}</strong>
                      <br />
                      {new Date(selectedStudent.enrollment_date).toLocaleDateString(
                        locale === 'ar' ? 'ar-SA' : 'en-US'
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {selectedStudent.subjects && selectedStudent.subjects.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">
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
                <div>
                  <h4 className="font-medium mb-2">
                    {t('students.parentsGuardians')}
                  </h4>
                  <div className="space-y-2">
                    {selectedStudent.parents.map((parent) => (
                      <div key={parent.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <div className="font-medium">{parent.name}</div>
                          <div className="text-sm text-gray-600">
                            {parent.relationship} • {parent.phone}
                          </div>
                        </div>
                        {parent.is_primary && (
                          <Badge variant="outline" className="text-xs">
                            {t('students.primary')}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedStudent.notes && (
                <div>
                  <h4 className="font-medium mb-2">
                    {t('students.fields.notes')}
                  </h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
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
                  className="bg-gray-50"
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
              <div className="text-red-500 text-sm bg-red-50 p-3 rounded">
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
    </div>
  );
}
