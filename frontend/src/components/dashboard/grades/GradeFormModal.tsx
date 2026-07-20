'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateGradeRequest } from '@/types';
import { Student } from '@/types';

interface GradeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  grade: CreateGradeRequest;
  onGradeChange: (grade: CreateGradeRequest) => void;
  students: Student[];
  currentSubjectName: string;
  formError: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const ASSESSMENT_TYPES = ['test', 'quiz', 'homework', 'project', 'midterm', 'final'];

export default function GradeFormModal({
  open,
  onOpenChange,
  mode,
  grade,
  onGradeChange,
  students,
  currentSubjectName,
  formError,
  submitting,
  onSubmit,
  onCancel,
}: GradeFormModalProps) {
  const t = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'add'
              ? currentSubjectName ? t('grades.addGradeForSubject', { subject: currentSubjectName }) : t('grades.addNewGrade')
              : t('grades.editGradeTitle')
            }
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'add' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="student_id">{t('grades.fields.student')} *</Label>
                <Select value={grade.student_id} onValueChange={(value) => onGradeChange({ ...grade, student_id: value })}>
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
                <Input id="subject" value={grade.subject || currentSubjectName} onChange={(e) => onGradeChange({ ...grade, subject: e.target.value })} placeholder={t('grades.subjectPlaceholder')} required disabled={!!currentSubjectName} />
              </div>
              <div>
                <Label htmlFor="assessment_type">{t('grades.fields.assessmentType')} *</Label>
                <Select value={grade.assessment_type} onValueChange={(value) => onGradeChange({ ...grade, assessment_type: value })}>
                  <SelectTrigger id="assessment_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSESSMENT_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{t(`grades.assessmentTypes.${type}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="assessment_name">{t('grades.fields.assessmentName')} *</Label>
                <Input id="assessment_name" value={grade.assessment_name} onChange={(e) => onGradeChange({ ...grade, assessment_name: e.target.value })} placeholder={t('grades.assessmentNamePlaceholder')} required />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`${mode}_score`}>{t('grades.fields.score')} *</Label>
              <Input id={`${mode}_score`} type="number" min="0" step="0.5" value={grade.score} onChange={(e) => onGradeChange({ ...grade, score: parseFloat(e.target.value) || 0 })} required />
            </div>
            <div>
              <Label htmlFor={`${mode}_max_score`}>{t('grades.fields.maxScore')} *</Label>
              <Input id={`${mode}_max_score`} type="number" min="1" value={grade.max_score} onChange={(e) => onGradeChange({ ...grade, max_score: parseFloat(e.target.value) || 100 })} required />
            </div>
          </div>
          {mode === 'add' && (
            <div>
              <Label htmlFor="date">{t('grades.fields.date')} *</Label>
              <Input id="date" type="date" value={grade.date} onChange={(e) => onGradeChange({ ...grade, date: e.target.value })} required />
            </div>
          )}
          <div>
            <Label htmlFor={`${mode}_notes`}>{t('grades.fields.notes')}</Label>
            <textarea id={`${mode}_notes`} className="w-full border rounded px-3 py-2" rows={3} value={grade.notes} onChange={(e) => onGradeChange({ ...grade, notes: e.target.value })} placeholder={t('grades.notesPlaceholder')} />
          </div>
          {formError && (
            <div className="text-destructive text-sm bg-destructive/10 p-3 rounded">{formError}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={submitting}>{submitting ? t('grades.saving') : t('common.save')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
