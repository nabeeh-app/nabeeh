'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Shield, CheckCircle, XCircle, Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';

interface InviteData {
  id: string;
  teacherName: string;
  permissions: Record<string, boolean>;
  expires_at: string;
}

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

export default function InviteAcceptPage() {
  const t = useTranslations('assistants');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchInvite = async () => {
      try {
        const res = await apiClient.getInviteByToken(token);
        if (res.success && res.data) {
          setInvite(res.data as InviteData);
        } else {
          setError(res.message || 'Invalid invitation');
        }
      } catch {
        setError('Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await apiClient.acceptInvite(token);
      if (res.success) {
        setAccepted(true);
      } else {
        setError(res.message || 'Failed to accept invitation');
      }
    } catch {
      setError('Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const handleGoToLogin = () => {
    router.push('/en/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h1 className="text-lg font-semibold text-[var(--color-ink)] font-body mb-2">Invitation Error</h1>
            <p className="text-sm text-[var(--color-ink)]/60 font-body">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h1 className="text-lg font-semibold text-[var(--color-ink)] font-body mb-2">Invitation Accepted!</h1>
            <p className="text-sm text-[var(--color-ink)]/60 font-body mb-4">
              You are now an assistant. Please log in to access your account.
            </p>
            <Button onClick={handleGoToLogin} className="w-full">
              <LogIn className="w-4 h-4 mr-2" />
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--color-surface-sage)] flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-[var(--color-primary)]" />
          </div>
          <CardTitle className="text-lg font-body">{t('inviteTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--color-ink)]/60 font-body text-center">
            <strong>{invite?.teacherName}</strong> has invited you to join their team as a teaching assistant.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--color-ink)]/40 uppercase tracking-wider font-body">
              {t('permissionsLabel')}
            </p>
            <div className="grid grid-cols-1 gap-1">
              {invite?.permissions && Object.entries(invite.permissions)
                .filter(([, enabled]) => enabled)
                .map(([key]) => (
                  <div key={key} className="flex items-center gap-2 text-sm text-[var(--color-ink)] font-body">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    {PERMISSION_LABELS[key]?.en || key}
                  </div>
                ))}
            </div>
          </div>

          <div className="text-xs text-[var(--color-ink)]/40 font-body text-center">
            Expires: {invite?.expires_at ? new Date(invite.expires_at).toLocaleDateString() : 'Unknown'}
          </div>

          <Button onClick={handleAccept} disabled={accepting} className="w-full">
            {accepting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            {accepting ? 'Accepting...' : 'Accept Invitation'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
