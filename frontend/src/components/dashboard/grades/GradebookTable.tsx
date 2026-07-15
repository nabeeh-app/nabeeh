'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';
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
import { useVirtualizer } from '@tanstack/react-virtual';

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

interface GradebookTableProps {
  gradebook: GradebookEntry[];
  uniqueAssessments: string[];
  currentSubjectName: string;
  getGradeColor: (percentage: number) => string;
}

export default function GradebookTable({
  gradebook,
  uniqueAssessments,
  currentSubjectName,
  getGradeColor,
}: GradebookTableProps) {
  const t = useTranslations();
  const scrollRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: gradebook.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  if (gradebook.length === 0) {
    return (
      <div className="space-y-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-ink font-display">
            {t('grades.gradebook')}
            {currentSubjectName && ` - ${currentSubjectName}`}
          </h2>
        </div>
        <div className="flex items-center justify-center py-12 text-ink/60">
          {t('grades.noGradesDisplay')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-ink font-display">
          {t('grades.gradebook')}
          {currentSubjectName && ` - ${currentSubjectName}`}
        </h2>
      </div>
      <div ref={scrollRef} className="overflow-x-auto max-h-[600px]">
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
            {virtualizer.getVirtualItems().map((virtualRow) => {
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
    </div>
  );
}
