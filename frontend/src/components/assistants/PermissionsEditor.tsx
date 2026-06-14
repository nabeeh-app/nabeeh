'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiClient } from '@/lib/client';
import type { Assistant } from '@/types';

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

interface PermissionsEditorProps {
  assistant: Assistant;
  onClose: () => void;
  onSave: () => void;
}

export function PermissionsEditor({ assistant, onClose, onSave }: PermissionsEditorProps) {
  const t = useTranslations('assistants');
  const locale = useLocale();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({ ...assistant.permissions });
  const [loading, setLoading] = useState(false);

  const handleToggle = (key: string) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiClient.updateAssistantPermissions(assistant.id, permissions);
      onSave();
    } catch {
      // error handled by apiClient
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t('editPermissionsTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-ink/60 font-body">
            {t('editingFor')} <span className="font-semibold">{assistant.name}</span>
          </p>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(permissions).map(([key, enabled]) => (
              <label
                key={key}
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  enabled
                    ? 'border-primary bg-surface-sage/30'
                    : 'border-border bg-canvas opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => handleToggle(key)}
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

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? t('saving') : t('savePermissions')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
