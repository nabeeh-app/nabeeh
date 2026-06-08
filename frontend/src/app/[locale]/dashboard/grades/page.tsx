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
// import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
// import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

  // Offerings & Groups State
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [openGroupSelect, setOpenGroupSelect] = useState(false);
  const [noGroups, setNoGroups] = useState(false);

  // View modes
  const [viewMode, setViewMode] = useState<'gradebook' | 'list' | 'entry'>('gradebook');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<string>('all');

  // Modals
  const [isAddGradeModalOpen, setAddGradeModalOpen] = useState(false);
  const [isBulkEntryModalOpen, setBulkEntryModalOpen] = useState(false);
  const [isStatsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<GradeWithStudent | null>(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  // Form state
  // Derived state
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

  useEffect(() => {
    loadOfferings();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      loadInitialData();
    } else if (offerings.length > 0) {
      // Clear data if no group selected
      setStudents([]);
      setGrades([]);
    }
  }, [selectedGroupId, dateRange]);

  const loadOfferings = async () => {
    try {
      const data = await apiClient.getOfferings();
      setOfferings(data || []);

      // Auto-select first group if available
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
      console.error('Error loading offerings:', err);
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

      // Find selected offering/group info
      let selectedSubjectName = '';
      offerings.forEach(offering => {
        const group = offering.groups.find((g) => g.id === selectedGroupId);
        if (group) {
          selectedSubjectName = offering.subject.name_en; // Or name based on locale? Backend returns name_en/ar via nested calls usually
        }
      });

      // Load students for this group
      const studentsResponse = await apiClient.getStudents({
        limit: 100,
        status: 'active',
        group_id: selectedGroupId
      });
      setStudents(studentsResponse.data);

      // Load grades for this subject (since grades are by subject/student)
      // We filter by subject to get relevant grades for this class context
      const gradesResponse = await apiClient.getGrades({
        limit: 500,
        date_from: dateRange.from,
        date_to: dateRange.to,
        subject: selectedSubjectName,
        group_id: selectedGroupId,
        // student_id: // We could iterate students but cleaner to get subject grades and filter later
      });

      // Filter grades to only students in this group
      const studentIds = new Set(studentsResponse.data.map(s => s.id));
      const gradesWithStudents = gradesResponse.data
        .filter(g => studentIds.has(g.student_id))
        .map(grade => ({
          ...grade,
          student: studentsResponse.data.find(s => s.id === grade.student_id) || {} as Student
        }));

      setGrades(gradesWithStudents);

    } catch (err: any) {
      console.error('Error loading grades data:', err);
      setError(err.message || 'Failed to load grades data');

      // Fallback to mock data
      const mockStudents: Student[] = [
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
          notes: null,
          emergency_contact: '+966501234567',
          address: 'Riyadh, Saudi Arabia',
          created_at: '2024-01-15T00:00:00Z',
          updated_at: '2024-12-21T00:00:00Z'
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
          notes: null,
          emergency_contact: '+966507654321',
          address: 'Jeddah, Saudi Arabia',
          created_at: '2024-02-10T00:00:00Z',
          updated_at: '2024-12-21T00:00:00Z'
        }
      ];

      const mockGrades: GradeWithStudent[] = [
        {
          id: '1',
          student_id: '1',
          teacher_id: 'teacher-1',
          subject: 'Mathematics',
          assessment_type: 'test',
          assessment_name: 'Midterm Exam',
          score: 85,
          max_score: 100,
          percentage: 85,
          letter_grade: 'B+',
          date: '2024-12-15',
          notes: 'Good performance',
          created_at: '2024-12-15T00:00:00Z',
          updated_at: '2024-12-15T00:00:00Z',
          student: mockStudents[0]
        },
        {
          id: '2',
          student_id: '2',
          teacher_id: 'teacher-1',
          subject: 'English',
          assessment_type: 'quiz',
          assessment_name: 'Vocabulary Quiz',
          score: 92,
          max_score: 100,
          percentage: 92,
          letter_grade: 'A-',
          date: '2024-12-18',
          notes: 'Excellent work',
          created_at: '2024-12-18T00:00:00Z',
          updated_at: '2024-12-18T00:00:00Z',
          student: mockStudents[1]
        }
      ];

      setStudents(mockStudents);
      setGrades(mockGrades);

    } finally {
      setLoading(false);
    }
  };

  const generateGradebook = () => {
    const filteredStudents = students; // We already filtered students by group

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
    if (percentage >= 90) return 'text-green-600 bg-green-100';
    if (percentage >= 80) return 'text-blue-600 bg-blue-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    if (percentage >= 60) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-fill subject if missing
    const gradeToSubmit = { ...newGrade };
    if (!gradeToSubmit.subject && currentSubjectName) {
      gradeToSubmit.subject = currentSubjectName;
    }

    const gradeWithGroup = {
      ...gradeToSubmit,
      group_id: gradeToSubmit.group_id || selectedGroupId
    };

    if (!gradeWithGroup.group_id || !gradeWithGroup.student_id || !gradeWithGroup.subject || !gradeWithGroup.assessment_name) {
      setFormError(locale === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
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
      console.error('Error creating grade:', err);
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
      setFormError(locale === 'ar' ? 'يرجى اختيار الفصل' : 'Please select a class');
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
      console.error('Error updating grade:', err);
      setFormError(err.message || 'Failed to update grade');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGrade = async (grade: GradeWithStudent) => {
    if (!confirm(locale === 'ar' ? 'هل أنت متأكد من حذف هذه الدرجة؟' : 'Are you sure you want to delete this grade?')) {
      return;
    }

    try {
      await apiClient.deleteGrade(grade.id);
      setGrades(prev => prev.filter(g => g.id !== grade.id));
    } catch (err: any) {
      console.error('Error deleting grade:', err);
      alert(err.message || 'Failed to delete grade');
    }
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
    // Update subject when resetting
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
    // Subject filter removed as we are already scoped to a class/subject
    const matchesAssessmentType = selectedAssessmentType === 'all' || grade.assessment_type === selectedAssessmentType;
    const matchesGradeFilter = gradeFilter === 'all' || getLetterGrade(grade.percentage) === gradeFilter;

    return matchesSearch && matchesAssessmentType && matchesGradeFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {locale === 'ar' ? 'جاري تحميل بيانات الدرجات...' : 'Loading grades data...'}
          </p>
        </div>
      </div>
    );
  }

  if (noGroups) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {locale === 'ar' ? 'لا توجد مجموعات بعد' : 'No groups yet'}
            </p>
            <p className="text-sm text-amber-700">
              {locale === 'ar'
                ? 'أنشئ مجموعة واحدة على الأقل قبل إدخال الدرجات.'
                : 'Create at least one group before entering grades.'}
            </p>
          </div>
          <Button asChild variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100">
            <Link href={`/${locale}/dashboard/classes?setup=required`}>
              {locale === 'ar' ? 'إعداد المجموعات' : 'Set up groups'}
            </Link>
          </Button>
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
            {locale === 'ar' ? 'إدارة الدرجات' : 'Grade Management'}
          </h1>
          <p className="text-gray-600 mt-2">
            {locale === 'ar'
              ? 'إدارة وتتبع درجات الطلاب والتقييمات'
              : 'Manage and track student grades and assessments'
            }
          </p>

          {/* Group Selector */}
          <div className="mt-4">
            <select
              className="w-[300px] border rounded-md p-2"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              <option value="" disabled>
                {locale === 'ar' ? 'اختر الفصل' : 'Select Class'}
              </option>
              {offerings.map((offering) => (
                <optgroup key={offering.id} label={offering.subject.name_en}>
                  {offering.groups.map((group: any) => (
                    <option key={group.id} value={group.id}>
                      {offering.subject.name_en} - {group.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            {locale === 'ar' ? 'تصدير' : 'Export'}
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            {locale === 'ar' ? 'استيراد' : 'Import'}
          </Button>
          <Dialog open={isStatsModalOpen} onOpenChange={setStatsModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <BarChart3 className="w-4 h-4 mr-2" />
                {locale === 'ar' ? 'الإحصائيات' : 'Statistics'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  {locale === 'ar' ? 'إحصائيات الدرجات' : 'Grade Statistics'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {subjectStats.map((stat, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{stat.subject}</h3>
                        <Badge variant="outline">
                          {stat.student_count} {locale === 'ar' ? 'طالب' : 'students'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">{locale === 'ar' ? 'المتوسط' : 'Average'}</div>
                          <div className="font-medium">{stat.average_score.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-gray-600">{locale === 'ar' ? 'الأعلى' : 'Highest'}</div>
                          <div className="font-medium text-green-600">{stat.highest_score}%</div>
                        </div>
                        <div>
                          <div className="text-gray-600">{locale === 'ar' ? 'الأدنى' : 'Lowest'}</div>
                          <div className="font-medium text-red-600">{stat.lowest_score}%</div>
                        </div>
                        <div>
                          <div className="text-gray-600">{locale === 'ar' ? 'التقييمات' : 'Assessments'}</div>
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
                {locale === 'ar' ? 'إضافة درجة' : 'Add Grade'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {locale === 'ar' ? 'إضافة درجة جديدة' : 'Add New Grade'}
                  {currentSubjectName && ` - ${currentSubjectName}`}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddGrade} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="student_id">
                      {locale === 'ar' ? 'الطالب' : 'Student'} *
                    </Label>
                    <select
                      id="student_id"
                      className="w-full border rounded px-3 py-2"
                      value={newGrade.student_id}
                      onChange={(e) => setNewGrade(s => ({ ...s, student_id: e.target.value }))}
                      required
                    >
                      <option value="">{locale === 'ar' ? 'اختر الطالب' : 'Select Student'}</option>
                      {students.map(student => (
                        <option key={student.id} value={student.id}>{student.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="subject">
                      {locale === 'ar' ? 'المادة' : 'Subject'} *
                    </Label>
                    <Input
                      id="subject"
                      value={newGrade.subject || currentSubjectName}
                      onChange={(e) => setNewGrade(s => ({ ...s, subject: e.target.value }))}
                      placeholder={locale === 'ar' ? 'مثال: الرياضيات' : 'e.g., Mathematics'}
                      required
                      disabled={!!currentSubjectName}
                    />
                  </div>
                  <div>
                    <Label htmlFor="assessment_type">
                      {locale === 'ar' ? 'نوع التقييم' : 'Assessment Type'} *
                    </Label>
                    <select
                      id="assessment_type"
                      className="w-full border rounded px-3 py-2"
                      value={newGrade.assessment_type}
                      onChange={(e) => setNewGrade(s => ({ ...s, assessment_type: e.target.value }))}
                    >
                      {assessmentTypes.map(type => (
                        <option key={type} value={type}>
                          {locale === 'ar'
                            ? {
                              test: 'اختبار',
                              quiz: 'مسابقة',
                              homework: 'واجب',
                              project: 'مشروع',
                              midterm: 'امتحان نصف الفصل',
                              final: 'امتحان نهائي'
                            }[type] || type
                            : type.charAt(0).toUpperCase() + type.slice(1)
                          }
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="assessment_name">
                      {locale === 'ar' ? 'اسم التقييم' : 'Assessment Name'} *
                    </Label>
                    <Input
                      id="assessment_name"
                      value={newGrade.assessment_name}
                      onChange={(e) => setNewGrade(s => ({ ...s, assessment_name: e.target.value }))}
                      placeholder={locale === 'ar' ? 'مثال: امتحان الوحدة الأولى' : 'e.g., Unit 1 Test'}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="score">
                      {locale === 'ar' ? 'الدرجة المحققة' : 'Score'} *
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
                      {locale === 'ar' ? 'الدرجة الكاملة' : 'Max Score'} *
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
                      {locale === 'ar' ? 'التاريخ' : 'Date'} *
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
                    {locale === 'ar' ? 'ملاحظات' : 'Notes'}
                  </Label>
                  <textarea
                    id="notes"
                    className="w-full border rounded px-3 py-2"
                    rows={3}
                    value={newGrade.notes}
                    onChange={(e) => setNewGrade(s => ({ ...s, notes: e.target.value }))}
                    placeholder={locale === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'}
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
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{grades.length}</p>
                <p className="text-sm text-gray-600">
                  {locale === 'ar' ? 'إجمالي الدرجات' : 'Total Grades'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{uniqueSubjects.length}</p>
                <p className="text-sm text-gray-600">
                  {locale === 'ar' ? 'المواد' : 'Subjects'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calculator className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">
                  {grades.length > 0 ? (grades.reduce((sum, g) => sum + g.percentage, 0) / grades.length).toFixed(1) : '0'}%
                </p>
                <p className="text-sm text-gray-600">
                  {locale === 'ar' ? 'المتوسط العام' : 'Overall Average'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Award className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">
                  {grades.filter(g => g.percentage >= 90).length}
                </p>
                <p className="text-sm text-gray-600">
                  {locale === 'ar' ? 'درجات ممتازة' : 'Excellent Grades'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          <Button
            variant={viewMode === 'gradebook' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('gradebook')}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {locale === 'ar' ? 'دفتر الدرجات' : 'Gradebook'}
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <GraduationCap className="w-4 h-4 mr-2" />
            {locale === 'ar' ? 'قائمة الدرجات' : 'Grade List'}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2">
          <Input
            placeholder={locale === 'ar' ? 'البحث...' : 'Search...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          {/* Subject Filter removed in favor of context-aware fetching */}
        </div>
      </div>

      {/* Gradebook View */}
      {viewMode === 'gradebook' && (
        <Card>
          <CardHeader>
            <CardTitle>
              {locale === 'ar' ? 'دفتر الدرجات' : 'Gradebook'}
              {currentSubjectName && ` - ${currentSubjectName}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gradebook.length === 0 ? (
              <div className="text-center py-8">
                <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {locale === 'ar' ? 'لا توجد درجات لعرضها' : 'No grades to display'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">
                        {locale === 'ar' ? 'الطالب' : 'Student'}
                      </TableHead>
                      {uniqueAssessments.slice(0, 5).map(assessment => (
                        <TableHead key={assessment} className="text-center min-w-[120px]">
                          {assessment}
                        </TableHead>
                      ))}
                      <TableHead className="text-center min-w-[100px]">
                        {locale === 'ar' ? 'المتوسط' : 'Average'}
                      </TableHead>
                      <TableHead className="text-center min-w-[80px]">
                        {locale === 'ar' ? 'التقدير' : 'Grade'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradebook.map((entry) => (
                      <TableRow key={entry.student_id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-blue-100 text-blue-700">
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
            <CardTitle>{locale === 'ar' ? 'قائمة الدرجات' : 'Grade List'}</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredGrades.length === 0 ? (
              <div className="text-center py-8">
                <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {locale === 'ar' ? 'لا توجد درجات مطابقة للبحث' : 'No grades found matching your search'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === 'ar' ? 'الطالب' : 'Student'}</TableHead>
                    <TableHead>{locale === 'ar' ? 'المادة' : 'Subject'}</TableHead>
                    <TableHead>{locale === 'ar' ? 'التقييم' : 'Assessment'}</TableHead>
                    <TableHead>{locale === 'ar' ? 'الدرجة' : 'Score'}</TableHead>
                    <TableHead>{locale === 'ar' ? 'النسبة' : 'Percentage'}</TableHead>
                    <TableHead>{locale === 'ar' ? 'التقدير' : 'Grade'}</TableHead>
                    <TableHead>{locale === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{locale === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
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
                            title={locale === 'ar' ? 'تعديل' : 'Edit'}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteGrade(grade)}
                            className="text-red-600 hover:text-red-700"
                            title={locale === 'ar' ? 'حذف' : 'Delete'}
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
              {locale === 'ar' ? 'تعديل الدرجة' : 'Edit Grade'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateGrade} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_score">
                  {locale === 'ar' ? 'الدرجة المحققة' : 'Score'} *
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
                  {locale === 'ar' ? 'الدرجة الكاملة' : 'Max Score'} *
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
                {locale === 'ar' ? 'ملاحظات' : 'Notes'}
              </Label>
              <textarea
                id="edit_notes"
                className="w-full border rounded px-3 py-2"
                rows={3}
                value={newGrade.notes}
                onChange={(e) => setNewGrade(s => ({ ...s, notes: e.target.value }))}
                placeholder={locale === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'}
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
