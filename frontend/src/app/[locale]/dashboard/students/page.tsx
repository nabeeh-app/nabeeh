'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
  Filter,
  Download,
  Upload,
  Users,
  GraduationCap,
  Phone,
  Mail,
  Calendar,
  MapPin,
  BookOpen
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Student, CreateStudentRequest, Parent, Offering } from '@/types';

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

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  // New: Offerings/Groups State
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');


  // Form state
  const [newStudent, setNewStudent] = useState<CreateStudentRequest>({
    student_id: '',
    name: '',
    grade_level: '',
    group_id: '', // New required field
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

  useEffect(() => {
    loadOfferings();
  }, []);

  useEffect(() => {
    loadStudents();
  }, [selectedGroupId]); // Reload when group changes

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, statusFilter, gradeFilter]);

  const loadOfferings = async () => {
    try {
      const data = await apiClient.getOfferings();
      setOfferings(data);
      // Auto-select first group if available and nothing selected?
      // For now keep 'all' as default
    } catch (err) {
      console.error('Failed checking offerings', err);
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

      // Mock parents data for demo - in real app, this would come from API
      const studentsWithParents = response.data.map(student => ({
        ...student,
        parents: [
          {
            id: `parent-${student.id}-1`,
            name: `Parent of ${student.name}`,
            phone: `+966${Math.floor(Math.random() * 1000000000)}`,
            is_primary: true,
            relationship: 'father',
            preferred_language: locale
          }
        ]
      }));

      setStudents(studentsWithParents);
    } catch (err: any) {
      console.error('Error loading students:', err);
      setError(err.message || 'Failed to load students');

      // Fallback to mock data
      const mockStudents: StudentWithParents[] = [
        {
          id: '1',
          teacher_id: 'teacher-1',
          student_id: 'ST001',
          name: 'أحمد محمد علي',
          grade_level: 'Grade 10',
          date_of_birth: '2008-05-15',
          gender: 'male',
          subjects: ['Mathematics', 'Physics'],
          enrollment_date: '2024-01-15',
          status: 'active',
          notes: 'Excellent student in mathematics',
          emergency_contact: '+966501234567',
          address: 'Riyadh, Saudi Arabia',
          created_at: '2024-01-15T00:00:00Z',
          updated_at: '2024-12-21T00:00:00Z',
          parents: [
            {
              id: 'parent-1',
              name: 'محمد علي أحمد',
              phone: '+966501234567',
              is_primary: true,
              relationship: 'father',
              preferred_language: 'ar'
            }
          ]
        },
        {
          id: '2',
          teacher_id: 'teacher-1',
          student_id: 'ST002',
          name: 'فاطمة سعد إبراهيم',
          grade_level: 'Grade 11',
          date_of_birth: '2007-08-22',
          gender: 'female',
          subjects: ['English', 'Chemistry'],
          enrollment_date: '2024-02-10',
          status: 'active',
          notes: 'Strong in languages',
          emergency_contact: '+966507654321',
          address: 'Jeddah, Saudi Arabia',
          created_at: '2024-02-10T00:00:00Z',
          updated_at: '2024-12-21T00:00:00Z',
          parents: [
            {
              id: 'parent-2',
              name: 'سعد إبراهيم محمد',
              phone: '+966507654321',
              is_primary: true,
              relationship: 'father',
              preferred_language: 'ar'
            }
          ]
        }
      ];
      setStudents(mockStudents);
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
      setFormError(locale === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const createdStudent = await apiClient.createStudent(newStudent);

      // Add to local state
      const studentWithParents: StudentWithParents = {
        ...createdStudent,
        parents: []
      };

      setStudents(prev => [...prev, studentWithParents]);
      setAddModalOpen(false);
      resetForm();

    } catch (err: any) {
      console.error('Error creating student:', err);
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
      setFormError(locale === 'ar' ? 'يرجى اختيار الفصل' : 'Please select a class');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const updatedStudent = await apiClient.updateStudent(selectedStudent.id, newStudent);

      // Update local state
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
      console.error('Error updating student:', err);
      setFormError(err.message || 'Failed to update student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async (student: StudentWithParents) => {
    if (!confirm(locale === 'ar' ? 'هل أنت متأكد من حذف هذا الطالب؟' : 'Are you sure you want to delete this student?')) {
      return;
    }

    try {
      await apiClient.deleteStudent(student.id);
      setStudents(prev => prev.filter(s => s.id !== student.id));
    } catch (err: any) {
      console.error('Error deleting student:', err);
      alert(err.message || 'Failed to delete student');
    }
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
        label: locale === 'ar' ? 'نشط' : 'Active',
        color: 'bg-green-100 text-green-800'
      },
      inactive: {
        variant: 'secondary' as const,
        label: locale === 'ar' ? 'غير نشط' : 'Inactive',
        color: 'bg-gray-100 text-gray-800'
      },
      graduated: {
        variant: 'outline' as const,
        label: locale === 'ar' ? 'متخرج' : 'Graduated',
        color: 'bg-blue-100 text-blue-800'
      }
    };

    return statusMap[status as keyof typeof statusMap] || statusMap.active;
  };

  const uniqueGrades = [...new Set(students.map(s => s.grade_level))].filter(Boolean);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {locale === 'ar' ? 'جاري تحميل الطلاب...' : 'Loading students...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {locale === 'ar' ? 'إدارة الطلاب' : 'Student Management'}
          </h1>
          <p className="text-gray-600 mt-2">
            {locale === 'ar'
              ? `إدارة وتتبع ${students.length} طالب مسجل`
              : `Manage and track ${students.length} registered students`
            }
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            {locale === 'ar' ? 'استيراد' : 'Import'}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            {locale === 'ar' ? 'تصدير' : 'Export'}
          </Button>
          <Dialog open={isAddModalOpen} onOpenChange={setAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {locale === 'ar' ? 'إضافة طالب جديد' : 'Add New Student'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {locale === 'ar' ? 'إضافة طالب جديد' : 'Add New Student'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddStudent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="student_id">
                      {locale === 'ar' ? 'رقم الطالب' : 'Student ID'} *
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
                      {locale === 'ar' ? 'اسم الطالب' : 'Student Name'} *
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
                      {locale === 'ar' ? 'الفصل/المجموعة' : 'Class/Group'} *
                    </Label>
                    <select
                      id="group_id"
                      className="w-full border rounded px-3 py-2"
                      value={newStudent.group_id}
                      onChange={(e) => {
                        const groupId = e.target.value;
                        // Auto file grade level if possible?
                        const group = offerings.flatMap(o => o.groups).find((g) => g.id === groupId);
                        const offering = offerings.find(o => o.groups.some((g) => g.id === groupId));

                        setNewStudent(s => ({
                          ...s,
                          group_id: groupId,
                          grade_level: offering?.grade_level?.name || s.grade_level
                        }));
                      }}
                      required
                    >
                      <option value="">{locale === 'ar' ? 'اختر الفصل' : 'Select Class'}</option>
                      {offerings.flatMap(o => o.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {o.subject.name_en} - {g.name}
                        </option>
                      )))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="grade_level">
                      {locale === 'ar' ? 'المستوى الدراسي' : 'Grade Level'} *
                    </Label>
                    <Input
                      id="grade_level"
                      value={newStudent.grade_level}
                      onChange={(e) => setNewStudent(s => ({ ...s, grade_level: e.target.value }))}
                      placeholder={locale === 'ar' ? 'مثال: الصف العاشر' : 'e.g., Grade 10'}
                      required
                      readOnly // Derived from group usually, but editable if needed
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="date_of_birth">
                      {locale === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}
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
                      {locale === 'ar' ? 'الجنس' : 'Gender'}
                    </Label>
                    <select
                      id="gender"
                      className="w-full border rounded px-3 py-2"
                      value={newStudent.gender}
                      onChange={(e) => setNewStudent(s => ({ ...s, gender: e.target.value }))}
                    >
                      <option value="">{locale === 'ar' ? 'اختر الجنس' : 'Select Gender'}</option>
                      <option value="male">{locale === 'ar' ? 'ذكر' : 'Male'}</option>
                      <option value="female">{locale === 'ar' ? 'أنثى' : 'Female'}</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="emergency_contact">
                      {locale === 'ar' ? 'جهة الاتصال للطوارئ' : 'Emergency Contact'}
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
                    {locale === 'ar' ? 'المواد' : 'Subjects'}
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
                    {locale === 'ar' ? 'العنوان' : 'Address'}
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
                    {locale === 'ar' ? 'ملاحظات' : 'Notes'}
                  </Label>
                  <textarea
                    id="notes"
                    className="w-full border rounded px-3 py-2"
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
                    {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting
                      ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                      : (locale === 'ar' ? 'حفظ' : 'Save')
                    }
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{students.length}</p>
                <p className="text-sm text-gray-600">
                  {locale === 'ar' ? 'إجمالي الطلاب' : 'Total Students'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  {students.filter(s => s.status === 'active').length}
                </p>
                <p className="text-sm text-gray-600">
                  {locale === 'ar' ? 'طلاب نشطون' : 'Active Students'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{uniqueGrades.length}</p>
                <p className="text-sm text-gray-600">
                  {locale === 'ar' ? 'مستويات دراسية' : 'Grade Levels'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">
                  {students.filter(s => {
                    const enrollmentDate = new Date(s.enrollment_date);
                    const oneMonthAgo = new Date();
                    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                    return enrollmentDate >= oneMonthAgo;
                  }).length}
                </p>
                <p className="text-sm text-gray-600">
                  {locale === 'ar' ? 'مسجلون حديثاً' : 'New This Month'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={locale === 'ar' ? 'البحث عن الطلاب بالاسم أو الرقم...' : 'Search students...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="border rounded px-3 py-2 min-w-[200px]"
              >
                <option value="all">{locale === 'ar' ? 'جميع الفصول' : 'All Classes'}</option>
                {offerings.flatMap(o => o.groups.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {o.subject.name_en} - {g.name}
                  </option>
                )))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="all">{locale === 'ar' ? 'جميع الحالات' : 'All Status'}</option>
                <option value="active">{locale === 'ar' ? 'نشط' : 'Active'}</option>
                <option value="inactive">{locale === 'ar' ? 'غير نشط' : 'Inactive'}</option>
                <option value="graduated">{locale === 'ar' ? 'متخرج' : 'Graduated'}</option>
              </select>
            </div>
          </div>
          {filteredStudents.length !== students.length && (
            <p className="text-sm text-gray-600 mt-2">
              {locale === 'ar'
                ? `عرض ${filteredStudents.length} من ${students.length} طالب`
                : `Showing ${filteredStudents.length} of ${students.length} students`
              }
            </p>
          )}
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === 'ar' ? 'قائمة الطلاب' : 'Students List'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' || gradeFilter !== 'all'
                  ? (locale === 'ar' ? 'لم يتم العثور على طلاب مطابقين للبحث' : 'No students found matching your search')
                  : (locale === 'ar' ? 'لا يوجد طلاب مسجلون بعد' : 'No students registered yet')
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{locale === 'ar' ? 'الطالب' : 'Student'}</TableHead>
                  <TableHead>{locale === 'ar' ? 'المعلومات' : 'Details'}</TableHead>
                  <TableHead>{locale === 'ar' ? 'المواد' : 'Subjects'}</TableHead>
                  <TableHead>{locale === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{locale === 'ar' ? 'تاريخ التسجيل' : 'Enrollment'}</TableHead>
                  <TableHead>{locale === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
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
                            <AvatarFallback className="bg-blue-100 text-blue-700">
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
                            title={locale === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStudent(student)}
                            title={locale === 'ar' ? 'تعديل' : 'Edit'}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStudent(student)}
                            className="text-red-600 hover:text-red-700"
                            title={locale === 'ar' ? 'حذف' : 'Delete'}
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
              {locale === 'ar' ? 'تفاصيل الطالب' : 'Student Details'}
            </DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xl">
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
                    {locale === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
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
                        <strong>{locale === 'ar' ? 'الجنس:' : 'Gender:'}</strong> {
                          selectedStudent.gender === 'male'
                            ? (locale === 'ar' ? 'ذكر' : 'Male')
                            : (locale === 'ar' ? 'أنثى' : 'Female')
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
                    {locale === 'ar' ? 'معلومات الاتصال' : 'Contact Information'}
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selectedStudent.emergency_contact && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{selectedStudent.emergency_contact}</span>
                      </div>
                    )}
                    <div>
                      <strong>{locale === 'ar' ? 'تاريخ التسجيل:' : 'Enrollment Date:'}</strong>
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
                    {locale === 'ar' ? 'المواد الدراسية' : 'Subjects'}
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
                    {locale === 'ar' ? 'أولياء الأمور' : 'Parents/Guardians'}
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
                            {locale === 'ar' ? 'أساسي' : 'Primary'}
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
                    {locale === 'ar' ? 'ملاحظات' : 'Notes'}
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
              {locale === 'ar' ? 'تعديل بيانات الطالب' : 'Edit Student'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateStudent} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_student_id">
                  {locale === 'ar' ? 'رقم الطالب' : 'Student ID'} *
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
                  {locale === 'ar' ? 'اسم الطالب' : 'Student Name'} *
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
                  {locale === 'ar' ? 'الفصل/المجموعة' : 'Class/Group'} *
                </Label>
                <select
                  id="edit_group_id"
                  className="w-full border rounded px-3 py-2"
                  value={newStudent.group_id}
                  onChange={(e) => {
                    const groupId = e.target.value;
                    const offering = offerings.find(o => o.groups.some((g) => g.id === groupId));
                    setNewStudent(s => ({
                      ...s,
                      group_id: groupId,
                      grade_level: offering?.grade_level?.name || s.grade_level
                    }));
                  }}
                  required
                >
                  <option value="">{locale === 'ar' ? 'اختر الفصل' : 'Select Class'}</option>
                  {offerings.flatMap(o => o.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {o.subject.name_en} - {g.name}
                    </option>
                  )))}
                </select>
              </div>
              <div>
                <Label htmlFor="edit_grade_level">
                  {locale === 'ar' ? 'المستوى الدراسي' : 'Grade Level'} *
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
                  {locale === 'ar' ? 'الحالة' : 'Status'}
                </Label>
                <select
                  id="edit_status"
                  className="w-full border rounded px-3 py-2"
                  value={newStudent.status}
                  onChange={(e) => setNewStudent(s => ({ ...s, status: e.target.value as 'active' | 'inactive' | 'graduated' }))}
                >
                  <option value="active">{locale === 'ar' ? 'نشط' : 'Active'}</option>
                  <option value="inactive">{locale === 'ar' ? 'غير نشط' : 'Inactive'}</option>
                  <option value="graduated">{locale === 'ar' ? 'متخرج' : 'Graduated'}</option>
                </select>
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
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                  : (locale === 'ar' ? 'حفظ التغييرات' : 'Save Changes')
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
