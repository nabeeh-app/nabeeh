'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRef } from 'react';
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
import { Edit, Trash2 } from 'lucide-react';
import { Student, Grade } from '@/types';
import { useVirtualizer } from '@tanstack/react-virtual';

interface GradeWithStudent extends Grade {
  student: Student;
}

interface GradeListTableProps {
  grades: GradeWithStudent[];
  onEdit: (grade: GradeWithStudent) => void;
  onDelete: (grade: GradeWithStudent) => void;
  getGradeColor: (percentage: number) => string;
  getLetterGrade: (percentage: number) => string;
}

export default function GradeListTable({
  grades,
  onEdit,
  onDelete,
  getGradeColor,
  getLetterGrade,
}: GradeListTableProps) {
  const t = useTranslations();
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: grades.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  if (grades.length === 0) {
    return (
      <div className="space-y-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-ink font-display">{t('grades.gradeList')}</h2>
        </div>
        <div className="flex items-center justify-center py-12 text-ink/60">
          {t('grades.noGradesMatch')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-ink font-display">{t('grades.gradeList')}</h2>
      </div>
      <div ref={scrollRef} className="overflow-auto max-h-[600px]">
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
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const grade = grades[virtualRow.index];
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
                      <Button variant="ghost" size="sm" onClick={() => onEdit(grade)} title={t('common.edit')}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(grade)} className="text-destructive hover:text-destructive/80" title={t('common.delete')}>
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
    </div>
  );
}
