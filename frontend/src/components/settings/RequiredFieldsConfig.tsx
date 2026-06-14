'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Settings, Lock, Save, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';

const OPTIONAL_FIELDS = [
  { key: 'phone', label: 'Phone' },
  { key: 'parent_phone', label: 'Parent Phone' },
  { key: 'parent_name', label: 'Parent Name' },
  { key: 'grade_level', label: 'Grade Level' },
  { key: 'date_of_birth', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'notes', label: 'Notes' },
  { key: 'emergency_contact', label: 'Emergency Contact' }
];

const LOCKED_FIELDS = ['name', 'student_code'];

export default function RequiredFieldsConfig() {
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
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-[var(--color-ink)]/60" />
        <h3 className="text-lg font-semibold text-[var(--color-ink)]">Required Fields for Import</h3>
      </div>

      <p className="text-sm text-[var(--color-ink)]/60">
        Configure which fields are required when importing students. Name and Student Code are always required.
      </p>

      <div className="space-y-2">
        {LOCKED_FIELDS.map((field) => (
          <div
            key={field}
            className="flex items-center justify-between rounded-lg border border-[var(--color-ink)]/10 bg-[var(--color-surface)] p-3"
          >
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-[var(--color-ink)]/30" />
              <span className="text-sm font-medium text-[var(--color-ink)]">{field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
            </div>
            <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
              Always Required
            </span>
          </div>
        ))}

        {OPTIONAL_FIELDS.map((field) => (
          <div
            key={field.key}
            className="flex items-center justify-between rounded-lg border border-[var(--color-ink)]/10 bg-[var(--color-surface)] p-3"
          >
            <span className="text-sm font-medium text-[var(--color-ink)]">{field.label}</span>
            <button
              onClick={() => toggleField(field.key)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                requiredFields[field.key] ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-ink)]/20'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  requiredFields[field.key] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
