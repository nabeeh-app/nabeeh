'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateStudentRequest } from '@/types';
import { Offering } from '@/types';

interface StudentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  student: CreateStudentRequest;
  onStudentChange: (student: CreateStudentRequest) => void;
  offerings: Offering[];
  formError: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function StudentFormModal({
  open,
  onOpenChange,
  mode,
  student,
  onStudentChange,
  offerings,
  formError,
  submitting,
  onSubmit,
  onCancel,
}: StudentFormModalProps) {
  const t = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? t('students.addStudent') : t('students.editStudent')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`${mode}_student_id`}>
                {t('students.fields.studentId')} *
              </Label>
              <Input
                id={`${mode}_student_id`}
                value={student.student_id}
                onChange={(e) => onStudentChange({ ...student, student_id: e.target.value })}
                placeholder={mode === 'add' ? t('students.studentIdPlaceholder') : undefined}
                required
              />
            </div>
            <div>
              <Label htmlFor={`${mode}_name`}>
                {t('students.fields.name')} *
              </Label>
              <Input
                id={`${mode}_name`}
                value={student.name}
                onChange={(e) => onStudentChange({ ...student, name: e.target.value })}
                placeholder={mode === 'add' ? t('students.fullNamePlaceholder') : undefined}
                required
              />
            </div>
            <div>
              <Label htmlFor={`${mode}_group_id`}>
                {t('students.fields.group')} *
              </Label>
              <Select
                value={student.group_id}
                onValueChange={(groupId) => {
                  const offering = offerings.find(o => o.groups.some((g) => g.id === groupId));
                  onStudentChange({
                    ...student,
                    group_id: groupId,
                    grade_level: offering?.grade_level?.name || student.grade_level
                  });
                }}
              >
                <SelectTrigger id={`${mode}_group_id`}>
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
              <Label htmlFor={`${mode}_grade_level`}>
                {t('students.fields.gradeLevel')} *
              </Label>
              <Input
                id={`${mode}_grade_level`}
                value={student.grade_level}
                onChange={(e) => onStudentChange({ ...student, grade_level: e.target.value })}
                placeholder={t('students.gradeLevelPlaceholder')}
                required
                readOnly
                className="bg-surface-cool"
              />
            </div>
            {mode === 'add' && (
              <>
                <div>
                  <Label htmlFor={`${mode}_date_of_birth`}>
                    {t('students.fields.dateOfBirth')}
                  </Label>
                  <Input
                    id={`${mode}_date_of_birth`}
                    type="date"
                    value={student.date_of_birth || ''}
                    onChange={(e) => onStudentChange({ ...student, date_of_birth: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`${mode}_gender`}>
                    {t('students.fields.gender')}
                  </Label>
                  <Select
                    value={student.gender || ''}
                    onValueChange={(value) => onStudentChange({ ...student, gender: value })}
                  >
                    <SelectTrigger id={`${mode}_gender`}>
                      <SelectValue placeholder={t('students.selectGender')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t('students.gender.male')}</SelectItem>
                      <SelectItem value="female">{t('students.gender.female')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`${mode}_emergency_contact`}>
                    {t('students.fields.emergencyContact')}
                  </Label>
                  <Input
                    id={`${mode}_emergency_contact`}
                    dir="ltr"
                    className="text-left"
                    value={student.emergency_contact || ''}
                    onChange={(e) => onStudentChange({ ...student, emergency_contact: e.target.value })}
                    placeholder="+966xxxxxxxxx"
                  />
                </div>
              </>
            )}
            {mode === 'edit' && (
              <div>
                <Label htmlFor={`${mode}_status`}>
                  {t('students.fields.status')}
                </Label>
                <Select
                  value={student.status || 'active'}
                  onValueChange={(value) => onStudentChange({ ...student, status: value as 'active' | 'inactive' | 'graduated' })}
                >
                  <SelectTrigger id={`${mode}_status`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('students.status.active')}</SelectItem>
                    <SelectItem value="inactive">{t('students.status.inactive')}</SelectItem>
                    <SelectItem value="graduated">{t('students.status.graduated')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {mode === 'add' && (
            <>
              <div>
                <Label htmlFor={`${mode}_subjects`}>
                  {t('students.fields.subjects')}
                </Label>
                <Input
                  id={`${mode}_subjects`}
                  value={Array.isArray(student.subjects) ? student.subjects.join(', ') : ''}
                  onChange={(e) => onStudentChange({
                    ...student,
                    subjects: e.target.value.split(',').map(subject => subject.trim()).filter(Boolean)
                  })}
                  placeholder={t('students.subjectsPlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor={`${mode}_address`}>
                  {t('students.fields.address')}
                </Label>
                <Input
                  id={`${mode}_address`}
                  value={student.address || ''}
                  onChange={(e) => onStudentChange({ ...student, address: e.target.value })}
                  placeholder={t('students.addressPlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor={`${mode}_notes`}>
                  {t('students.fields.notes')}
                </Label>
                <Textarea
                  id={`${mode}_notes`}
                  rows={3}
                  value={student.notes || ''}
                  onChange={(e) => onStudentChange({ ...student, notes: e.target.value })}
                  placeholder={t('students.notesPlaceholder')}
                />
              </div>
            </>
          )}
          {formError && (
            <div className="text-destructive text-sm bg-destructive/10 p-3 rounded">
              {formError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
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
  );
}
