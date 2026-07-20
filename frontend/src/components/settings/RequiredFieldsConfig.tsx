'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Settings, Lock, Save, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/client';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const OPTIONAL_FIELDS = [
  { key: 'phone', labelKey: 'fieldPhone' },
  { key: 'parent_phone', labelKey: 'fieldParentPhone' },
  { key: 'parent_name', labelKey: 'fieldParentName' },
  { key: 'grade_level', labelKey: 'fieldGradeLevel' },
  { key: 'date_of_birth', labelKey: 'fieldDateOfBirth' },
  { key: 'gender', labelKey: 'fieldGender' },
  { key: 'email', labelKey: 'fieldEmail' },
  { key: 'address', labelKey: 'fieldAddress' },
  { key: 'notes', labelKey: 'fieldNotes' },
  { key: 'emergency_contact', labelKey: 'fieldEmergencyContact' }
];

const LOCKED_FIELDS = ['name', 'student_code'];

export default function RequiredFieldsConfig() {
  const t = useTranslations('settings');
  const [requiredFields, setRequiredFields] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getSettings()
      .then((settings) => {
        if (cancelled) return;
        const fields = (settings as unknown as Record<string, unknown>).required_fields as Record<string, boolean> | undefined;
        if (fields) {
          setRequiredFields(fields);
        } else {
          const defaults: Record<string, boolean> = {};
          OPTIONAL_FIELDS.forEach((f) => {
            defaults[f.key] = false;
          });
          setRequiredFields(defaults);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        const defaults: Record<string, boolean> = {};
        OPTIONAL_FIELDS.forEach((f) => {
          defaults[f.key] = false;
        });
        setRequiredFields(defaults);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const toggleField = (key: string) => {
    setRequiredFields((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.updateSettings({ required_fields: requiredFields } as never);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Settings update failed
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-[var(--color-ink)]/60" />
        <h3 className="text-lg font-semibold text-[var(--color-ink)]">{t('requiredFieldsTitle')}</h3>
      </div>

      <p className="text-sm text-[var(--color-ink)]/60">
        {t('requiredFieldsDescription')}
      </p>

      <div className="space-y-2">
        {LOCKED_FIELDS.map((field) => (
          <div
            key={field}
            className="flex items-center justify-between rounded-lg border border-[var(--color-ink)]/10 bg-[var(--color-surface)] p-3"
          >
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-[var(--color-ink)]/30" />
              <span className="text-sm font-medium text-[var(--color-ink)]">{t(field === 'name' ? 'fieldName' : 'fieldStudentCode')}</span>
            </div>
            <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
              {t('alwaysRequired')}
            </span>
          </div>
        ))}

        {OPTIONAL_FIELDS.map((field) => (
          <div
            key={field.key}
            className="flex items-center justify-between rounded-lg border border-[var(--color-ink)]/10 bg-[var(--color-surface)] p-3"
          >
            <span className="text-sm font-medium text-[var(--color-ink)]">{t(field.labelKey)}</span>
            <Switch
              checked={requiredFields[field.key]}
              onCheckedChange={() => toggleField(field.key)}
            />
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saved ? t('saved') : t('saveSettings')}
      </Button>
    </div>
  );
}
