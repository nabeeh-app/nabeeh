'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Send, Mail, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { apiClient } from '@/lib/client';

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  view_students: true,
  manage_attendance: true,
  manage_grades: false,
  manage_assessments: false,
  manage_offerings: false,
  send_whatsapp: false,
  view_reports: true,
  manage_students: false,
};

const PERMISSION_LABELS: Record<string, { en: string; ar: string }> = {
  view_students: { en: 'View Students', ar: 'عرض الطلاب' },
  manage_attendance: { en: 'Manage Attendance', ar: 'إدارة الحضور' },
  manage_grades: { en: 'Manage Grades', ar: 'إدارة الدرجات' },
  manage_assessments: { en: 'Manage Assessments', ar: 'إدارة التقييمات' },
  manage_offerings: { en: 'Manage Courses', ar: 'إدارة الدورات' },
  send_whatsapp: { en: 'Send WhatsApp Messages', ar: 'إرسال رسائل واتساب' },
  view_reports: { en: 'View Reports', ar: 'عرض التقارير' },
  manage_students: { en: 'Manage Students', ar: 'إدارة الطلاب' },
};

type DeliveryMethod = 'email' | 'whatsapp' | 'both';

interface InviteFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteForm({ onClose, onSuccess }: InviteFormProps) {
  const t = useTranslations('assistants');
  const locale = useLocale();
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [permissions, setPermissions] = useState<Record<string, boolean>>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleTogglePermission = (key: string) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const needsEmail = deliveryMethod === 'email' || deliveryMethod === 'both';
    const needsPhone = deliveryMethod === 'whatsapp' || deliveryMethod === 'both';

    if (needsEmail && !email) {
      setError(t('invalidEmail'));
      return;
    }
    if (needsPhone && !phone) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.inviteAssistantDual({
        email: needsEmail ? email : undefined,
        phone: needsPhone ? phone : undefined,
        deliveryMethod,
        permissions,
      });
      if (res.success) {
        const target = needsEmail ? email : phone;
        setSuccess(t('inviteSent', { email: target }));
        setTimeout(() => onSuccess(), 1500);
      } else {
        setError(res.message || t('inviteFailed'));
      }
    } catch {
      setError(t('inviteFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {t('inviteTitle')}
          </DialogTitle>
          <DialogDescription>{t('inviteDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Delivery Method Toggle */}
          <div>
            <Label className="mb-2 block">{t('deliveryMethod')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'email', icon: Mail, label: t('deliveryEmail') },
                { value: 'whatsapp', icon: Smartphone, label: t('deliveryWhatsApp') },
                { value: 'both', icon: Send, label: t('deliveryBoth') },
              ] as const).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDeliveryMethod(value)}
                  className={`flex items-center justify-center gap-2 p-2 rounded-md border text-sm font-body transition-colors ${
                    deliveryMethod === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-canvas text-ink/60 hover:bg-surface-sage/30'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Email Field */}
          {(deliveryMethod === 'email' || deliveryMethod === 'both') && (
            <div>
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className="mt-1"
              />
            </div>
          )}

          {/* Phone Field */}
          {(deliveryMethod === 'whatsapp' || deliveryMethod === 'both') && (
            <div>
              <Label htmlFor="phone">{t('phoneLabel')}</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+20 1X XXX XXXX"
                className="mt-1"
              />
            </div>
          )}

          {/* Permissions */}
          <div>
            <Label className="mb-2 block">{t('permissionsLabel')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(permissions).map(([key, enabled]) => (
                <label
                  key={key}
                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                    enabled
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-canvas opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => handleTogglePermission(key)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                      enabled ? 'bg-primary border-primary' : 'border-ink/30'
                    }`}
                  >
                    {enabled && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-body text-ink">
                    {PERMISSION_LABELS[key]?.[locale as 'en' | 'ar'] || key}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive font-body">{error}</p>
          )}
          {success && (
            <p className="text-sm text-success font-body">{success}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('sending') : t('sendInvite')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
