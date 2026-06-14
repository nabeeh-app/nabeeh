'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';

interface FormSchema {
  groupName: string;
  teacherName: string;
  fields: string[];
}

export default function StudentRegistrationPage() {
  const t = useTranslations('selfRegistration');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const hasToken = !!token;
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(hasToken);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    !hasToken ? 'No registration token found' : null
  );
  const [success, setSuccess] = useState(false);
  const [studentCode, setStudentCode] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    apiClient
      .getRegistrationForm(token)
      .then((data) => {
        if (!cancelled) {
          setSchema(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load registration form');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!token || !name.trim()) return;

      setSubmitting(true);
      setError(null);
      try {
        const result = await apiClient.submitRegistration(token, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          parent_phone: parentPhone.trim() || undefined
        });
        setStudentCode(result.studentCode);
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed');
      } finally {
        setSubmitting(false);
      }
    },
    [token, name, phone, parentPhone]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error && !schema) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="rounded-full bg-red-50 p-4 mx-auto w-fit">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-semibold text-[var(--color-ink)]">{t('formTitle')}</h1>
          <p className="text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="rounded-full bg-green-50 p-4 mx-auto w-fit">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--color-ink)]">{t('successTitle')}</h1>
          <p className="text-sm text-[var(--color-ink)]/60">{t('successMessage')}</p>
          {studentCode && (
            <p className="text-sm text-[var(--color-ink)]/60">
              Your student code: <span className="font-mono font-semibold">{studentCode}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">{t('formTitle')}</h1>
          <p className="text-sm text-[var(--color-ink)]/60">
            {t('formDescription', { teacher: schema?.teacherName || '' })}
          </p>
          {schema?.groupName && (
            <p className="text-sm font-medium text-[var(--color-primary)]">
              {t('groupName', { name: schema.groupName })}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--color-ink)]/20 bg-[var(--color-surface)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-ink)]/20 bg-[var(--color-surface)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
              placeholder="+20 1XX XXX XXXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Parent Phone</label>
            <input
              type="tel"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-ink)]/20 bg-[var(--color-surface)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
              placeholder="+20 1XX XXX XXXX"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
          >
            {submitting ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
