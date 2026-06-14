'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bell,
  Clock,
  Save,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface Prefs {
  attendance_marked: boolean;
  grade_entered: boolean;
  whatsapp_sent: boolean;
  assistant_action: boolean;
  digest: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

const DEFAULT_PREFS: Prefs = {
  attendance_marked: true,
  grade_entered: true,
  whatsapp_sent: true,
  assistant_action: true,
  digest: true,
  quiet_hours_start: '',
  quiet_hours_end: '',
};

export function NotificationPreferences() {
  const t = useTranslations('notifications');
  const { teacher } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchPrefs = useCallback(async () => {
    try {
      if (teacher?.settings?.notification_preferences) {
        setPrefs({
          ...DEFAULT_PREFS,
          ...teacher.settings.notification_preferences,
        });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [teacher]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const handleToggle = (key: keyof Prefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleTimeChange = (key: 'quiet_hours_start' | 'quiet_hours_end', value: string) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await apiClient.updateNotificationPreferences(prefs);
      if (res.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 border-b-2 border-ink mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const TOGGLE_ITEMS: Array<{ key: keyof Prefs; labelKey: string }> = [
    { key: 'attendance_marked', labelKey: 'prefAttendanceMarked' },
    { key: 'grade_entered', labelKey: 'prefGradeEntered' },
    { key: 'whatsapp_sent', labelKey: 'prefWhatsappSent' },
    { key: 'assistant_action', labelKey: 'prefAssistantAction' },
    { key: 'digest', labelKey: 'prefDigest' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-ink font-display">
          <Bell className="h-5 w-5" />
          {t('preferencesTitle')}
        </CardTitle>
        <CardDescription className="font-body">
          {t('preferencesDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          {TOGGLE_ITEMS.map(item => (
            <div
              key={item.key}
              className="flex items-center justify-between p-3 rounded-lg border border-border"
            >
              <Label htmlFor={item.key} className="font-body text-ink cursor-pointer">
                {t(item.labelKey)}
              </Label>
              <Switch
                id={item.key}
                checked={prefs[item.key] as boolean}
                onCheckedChange={() => handleToggle(item.key)}
              />
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-ink/50" />
            <h4 className="text-sm font-semibold text-ink font-body">
              {t('quietHours')}
            </h4>
          </div>
          <p className="text-sm text-ink/60 font-body mb-3">
            {t('quietHoursDesc')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="quiet_start" className="text-sm font-body">
                {t('from')}
              </Label>
              <Input
                id="quiet_start"
                type="time"
                value={prefs.quiet_hours_start}
                onChange={e => handleTimeChange('quiet_hours_start', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="quiet_end" className="text-sm font-body">
                {t('to')}
              </Label>
              <Input
                id="quiet_end"
                type="time"
                value={prefs.quiet_hours_end}
                onChange={e => handleTimeChange('quiet_hours_end', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? t('saving') : t('savePreferences')}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600 font-body">
              <CheckCircle className="h-4 w-4" />
              {t('saved')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
