'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GraduationCap, Phone, Calendar, MapPin } from 'lucide-react';
import { Student, Parent } from '@/types';

interface StudentWithParents extends Student {
  parents: Parent[];
}

interface StudentDetailSidebarProps {
  student: StudentWithParents | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getStatusBadge: (status: string) => { variant: 'default' | 'secondary' | 'outline'; label: string; color: string };
}

export default function StudentDetailSidebar({
  student,
  open,
  onOpenChange,
  getStatusBadge,
}: StudentDetailSidebarProps) {
  const t = useTranslations();
  const locale = useLocale();

  if (!student) return null;

  const status = getStatusBadge(student.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {student.name.split(' ')[0].charAt(0)}
                {student.name.split(' ')[1]?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-semibold truncate">{student.name}</h3>
                <Badge variant={status.variant} className="shrink-0">
                  {status.label}
                </Badge>
              </div>
              <p className="text-sm text-ink/60 mt-0.5" dir="ltr" style={{ direction: 'ltr' }}>
                ID: {student.student_id}
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
                  <span>{student.grade_level}</span>
                </div>
                {student.date_of_birth && (
                  <div className="flex items-center gap-2.5">
                    <Calendar className="h-4 w-4 text-ink/40 shrink-0" />
                    <span>
                      {new Date(student.date_of_birth).toLocaleDateString(
                        locale === 'ar' ? 'ar-SA' : 'en-US'
                      )}
                    </span>
                  </div>
                )}
                {student.gender && (
                  <div className="flex items-center gap-2.5">
                    <span className="text-ink/40">·</span>
                    <span>
                      <span className="text-ink/60">{t('students.genderLabel')}</span>{' '}
                      {student.gender === 'male'
                        ? t('students.gender.male')
                        : t('students.gender.female')
                      }
                    </span>
                  </div>
                )}
                {student.address && (
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 text-ink/40 shrink-0" />
                    <span>{student.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-ink/80 border-b border-ink/10 pb-1.5">
                {t('students.contactInfo')}
              </h4>
              <div className="space-y-2.5 text-sm">
                {student.emergency_contact && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-ink/40 shrink-0" />
                    <span dir="ltr" style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>
                      {student.emergency_contact}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-4 w-4 text-ink/40 shrink-0" />
                  <span>
                    <span className="text-ink/60">{t('students.enrollmentDateLabel')}:</span>{' '}
                    {new Date(student.enrollment_date).toLocaleDateString(
                      locale === 'ar' ? 'ar-SA' : 'en-US'
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {student.subjects && student.subjects.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-ink/80 border-b border-ink/10 pb-1.5">
                {t('students.fields.subjects')}
              </h4>
              <div className="flex flex-wrap gap-2">
                {student.subjects.map((subject, index) => (
                  <Badge key={index} variant="outline">
                    {subject}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {student.parents && student.parents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-ink/80 border-b border-ink/10 pb-1.5">
                {t('students.parentsGuardians')}
              </h4>
              <div className="space-y-2">
                {student.parents.map((parent) => (
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

          {student.notes && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-ink/80 border-b border-ink/10 pb-1.5">
                {t('students.fields.notes')}
              </h4>
              <p className="text-sm text-ink/60 bg-surface-cool p-3 rounded">
                {student.notes}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
