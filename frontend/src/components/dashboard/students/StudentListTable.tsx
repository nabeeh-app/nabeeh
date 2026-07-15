'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Edit, Trash2, Eye, GraduationCap, Phone, Users } from 'lucide-react';
import { Student, Parent } from '@/types';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';

interface StudentWithParents extends Student {
  parents: Parent[];
}

interface StudentListTableProps {
  students: StudentWithParents[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  searchTerm: string;
  statusFilter: string;
  gradeFilter: string;
  onView: (student: StudentWithParents) => void;
  onEdit: (student: StudentWithParents) => void;
  onDelete: (student: StudentWithParents) => void;
  getStatusBadge: (status: string) => { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string; color: string };
}

export default function StudentListTable({
  students,
  page,
  totalPages,
  onPageChange,
  searchTerm,
  statusFilter,
  gradeFilter,
  onView,
  onEdit,
  onDelete,
  getStatusBadge,
}: StudentListTableProps) {
  const t = useTranslations();
  const locale = useLocale();

  if (students.length === 0) {
    return (
      <EmptyState
        icon={Users}
        message={
          searchTerm || statusFilter !== 'all' || gradeFilter !== 'all'
            ? t('students.noStudentsMatch')
            : t('students.noStudentsYet')
        }
      />
    );
  }

  return (
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
          {students.map((student) => {
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
                    {formatDate(student.enrollment_date, locale)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(student)}
                      aria-label={t('students.viewDetails')}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(student)}
                      aria-label={t('common.edit')}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(student)}
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
        onPageChange={onPageChange}
      />
    </>
  );
}
