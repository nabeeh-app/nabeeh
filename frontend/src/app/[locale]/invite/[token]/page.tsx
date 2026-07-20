'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Shield, CheckCircle, XCircle, Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/client';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface InviteData {
  id: string;
  teacherName: string;
  permissions: Record<string, boolean>;
  expires_at: string;
}

const PERMISSION_KEY_MAP: Record<string, string> = {
  view_students: 'permissionViewStudents',
  manage_attendance: 'permissionManageAttendance',
  manage_grades: 'permissionManageGrades',
  manage_assessments: 'permissionManageAssessments',
  manage_offerings: 'permissionManageOfferings',
  send_whatsapp: 'permissionSendWhatsapp',
  view_reports: 'permissionViewReports',
  manage_students: 'permissionManageStudents',
};

export default function InviteAcceptPage() {
  const t = useTranslations('assistants');
  const locale = useLocale();
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
        const data = await apiClient.getInviteByToken(token);
        if (data) {
          setInvite(data as InviteData);
        } else {
          setError(t('inviteError'));
        }
      } catch {
        setError(t('loadError'));
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token, t]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await apiClient.acceptInvite(token);
      setAccepted(true);
    } catch {
      setError(t('acceptError'));
    } finally {
      setAccepting(false);
    }
  };

  const handleGoToLogin = () => {
    router.push(`/${locale}/login`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)]">
        <LoadingSpinner message={t('loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-error" />
            <h1 className="text-lg font-semibold text-[var(--color-ink)] font-body mb-2">{t('inviteError')}</h1>
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
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success" />
            <h1 className="text-lg font-semibold text-[var(--color-ink)] font-body mb-2">{t('inviteAccepted')}</h1>
            <p className="text-sm text-[var(--color-ink)]/60 font-body mb-4">
              {t('inviteAcceptedDesc')}
            </p>
            <Button onClick={handleGoToLogin} className="w-full">
              <LogIn className="w-4 h-4 ms-2" />
              {t('goToLogin')}
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
            {t('invitedBy', { teacherName: invite?.teacherName || '' })}
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
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                    {t(PERMISSION_KEY_MAP[key] || key)}
                  </div>
                ))}
            </div>
          </div>

          <div className="text-xs text-[var(--color-ink)]/40 font-body text-center">
            {t('expires')} {invite?.expires_at ? new Date(invite.expires_at).toLocaleDateString() : t('unknownExpiry')}
          </div>

          <Button onClick={handleAccept} disabled={accepting} className="w-full">
            {accepting ? (
              <Loader2 className="w-4 h-4 ms-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 ms-2" />
            )}
            {accepting ? t('accepting') : t('acceptInvitation')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
