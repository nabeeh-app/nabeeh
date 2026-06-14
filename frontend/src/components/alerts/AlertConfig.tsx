'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Bell,
  Plus,
  Trash2,
  Pencil,
  Shield,
  TrendingDown,
  GraduationCap,
  AlertTriangle,
  Users,
  PencilRuler,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { AlertRule } from '@/types';

const ALERT_TYPE_OPTIONS = [
  { value: 'attendance_threshold', icon: Shield, labelKey: 'attendanceThreshold' },
  { value: 'grade_threshold', icon: GraduationCap, labelKey: 'gradeThreshold' },
  { value: 'trend_anomaly', icon: TrendingDown, labelKey: 'trendAnomaly' },
] as const;

const COMPARISON_OPTIONS = [
  { value: 'gt', labelKey: 'comparisonGt' },
  { value: 'gte', labelKey: 'comparisonGte' },
  { value: 'lt', labelKey: 'comparisonLt' },
  { value: 'lte', labelKey: 'comparisonLte' },
] as const;

const NOTIFICATION_METHOD_OPTIONS = [
  { value: 'in_app', labelKey: 'inApp' },
  { value: 'whatsapp', labelKey: 'whatsapp' },
  { value: 'both', labelKey: 'both' },
] as const;

interface RuleFormData {
  alert_type: string;
  threshold_value: number;
  comparison: string;
  notification_method: string;
}

const DEFAULT_FORM_DATA: RuleFormData = {
  alert_type: 'attendance_threshold',
  threshold_value: 3,
  comparison: 'gt',
  notification_method: 'in_app',
};

interface PresetOption {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  descKey: string;
  data: RuleFormData;
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'low-attendance',
    icon: AlertTriangle,
    labelKey: 'presetLowAttendance',
    descKey: 'presetLowAttendanceDesc',
    data: { alert_type: 'attendance_threshold', threshold_value: 25, comparison: 'gt', notification_method: 'in_app' },
  },
  {
    id: 'failing-grade',
    icon: GraduationCap,
    labelKey: 'presetFailingGrade',
    descKey: 'presetFailingGradeDesc',
    data: { alert_type: 'grade_threshold', threshold_value: 50, comparison: 'lt', notification_method: 'in_app' },
  },
  {
    id: 'high-absenteeism',
    icon: Users,
    labelKey: 'presetHighAbsenteeism',
    descKey: 'presetHighAbsenteeismDesc',
    data: { alert_type: 'attendance_threshold', threshold_value: 50, comparison: 'gt', notification_method: 'in_app' },
  },
  {
    id: 'grade-trend',
    icon: TrendingDown,
    labelKey: 'presetGradeTrend',
    descKey: 'presetGradeTrendDesc',
    data: { alert_type: 'trend_anomaly', threshold_value: 0, comparison: 'gt', notification_method: 'in_app' },
  },
];

export function AlertConfig() {
  const t = useTranslations('alerts');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<'preset' | 'form'>('preset');
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(DEFAULT_FORM_DATA);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadRules = () => {
    apiClient
      .getAlertRules()
      .then(res => {
        if (res.success) {
          setRules(res.data as AlertRule[]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getAlertRules()
      .then(res => {
        if (cancelled) return;
        if (res.success) {
          setRules(res.data as AlertRule[]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData(DEFAULT_FORM_DATA);
    setError('');
    setDialogStep('preset');
    setDialogOpen(true);
  };

  const handleOpenEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setFormData({
      alert_type: rule.alert_type,
      threshold_value: rule.threshold_value,
      comparison: rule.comparison,
      notification_method: rule.notification_method,
    });
    setError('');
    setDialogStep('form');
    setDialogOpen(true);
  };

  const handleSelectPreset = (preset: PresetOption) => {
    setFormData(preset.data);
    setDialogStep('form');
  };

  const handleCustomRule = () => {
    setFormData(DEFAULT_FORM_DATA);
    setDialogStep('form');
  };

  const handleBackToPresets = () => {
    setError('');
    setDialogStep('preset');
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      if (editingRule) {
        const res = await apiClient.updateAlertRule(editingRule.id, formData);
        if (!res.success) {
          setError(res.message || t('saveFailed'));
          return;
        }
      } else {
        const res = await apiClient.createAlertRule(formData);
        if (!res.success) {
          setError(res.message || t('saveFailed'));
          return;
        }
      }
      setDialogOpen(false);
      loadRules();
    } catch {
      setError(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteAlertRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch {
      // silent
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await apiClient.toggleAlertRule(id);
      if (res.success) {
        setRules(prev =>
          prev.map(r => (r.id === id ? { ...r, is_enabled: res.data.is_enabled } : r))
        );
      }
    } catch {
      // silent
    }
  };

  const getAlertTypeLabel = (type: string) => {
    const option = ALERT_TYPE_OPTIONS.find(o => o.value === type);
    return option ? t(option.labelKey) : type;
  };

  const getComparisonLabel = (comp: string) => {
    const option = COMPARISON_OPTIONS.find(o => o.value === comp);
    return option ? t(option.labelKey) : comp;
  };

  const getNotificationLabel = (method: string) => {
    const option = NOTIFICATION_METHOD_OPTIONS.find(o => o.value === method);
    return option ? t(option.labelKey) : method;
  };

  const getThresholdDescription = (rule: AlertRule) => {
    if (rule.alert_type === 'attendance_threshold') {
      return t('attendanceRuleDesc', {
        comparison: getComparisonLabel(rule.comparison),
        threshold: rule.threshold_value,
      });
    }
    if (rule.alert_type === 'grade_threshold') {
      return t('gradeRuleDesc', {
        comparison: getComparisonLabel(rule.comparison),
        threshold: rule.threshold_value,
      });
    }
    return t('trendRuleDesc');
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-ink font-display">
          <Bell className="h-5 w-5" />
          {t('configuration')}
        </CardTitle>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-1" />
          {t('addRule')}
        </Button>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <div className="text-center py-8 text-ink/60 font-body">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{t('noRules')}</p>
            <p className="text-sm mt-1">{t('noRulesDesc')}</p>
          </div>
        ) : (
           <div className="space-y-3">
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  rule.is_enabled
                    ? 'border-primary/30 bg-surface-sage/20'
                    : 'border-border bg-canvas'
                }`}
              >
                <div className={`flex items-center gap-3 min-w-0 ${!rule.is_enabled ? 'opacity-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.is_enabled ? 'default' : 'outline'}>
                        {getAlertTypeLabel(rule.alert_type)}
                      </Badge>
                      <Badge variant="secondary">
                        {getNotificationLabel(rule.notification_method)}
                      </Badge>
                    </div>
                    <p className="text-sm text-ink/70 mt-1 font-body truncate">
                      {getThresholdDescription(rule)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant={rule.is_enabled ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => handleToggle(rule.id)}
                  >
                    {rule.is_enabled ? t('disable') : t('enable')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEdit(rule)}
                    aria-label={t('edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(rule.id)}
                    aria-label={t('delete')}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {editingRule ? t('editRule') : t('createRule')}
              </DialogTitle>
              <DialogDescription>
                {dialogStep === 'preset' && !editingRule
                  ? t('choosePreset')
                  : t('ruleDescription')}
              </DialogDescription>
            </DialogHeader>

            {dialogStep === 'preset' && !editingRule ? (
              <div className="space-y-2">
                {PRESET_OPTIONS.map(preset => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border text-start transition-colors',
                        'border-border hover:border-primary/40 hover:bg-surface-sage/20'
                      )}
                    >
                      <div className="shrink-0 h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink font-body">
                          {t(preset.labelKey)}
                        </p>
                        <p className="text-xs text-ink/50 font-body">
                          {t(preset.descKey)}
                        </p>
                      </div>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={handleCustomRule}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border text-start transition-colors',
                    'border-dashed border-ink/20 hover:border-primary/40 hover:bg-surface-sage/20'
                  )}
                >
                  <div className="shrink-0 h-9 w-9 rounded-md bg-ink/5 flex items-center justify-center">
                    <PencilRuler className="h-4.5 w-4.5 text-ink/40" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink font-body">
                      {t('customRule')}
                    </p>
                    <p className="text-xs text-ink/50 font-body">
                      {t('customRuleDesc')}
                    </p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>{t('alertType')}</Label>
                  <Select
                    value={formData.alert_type}
                    onValueChange={val => setFormData(prev => ({ ...prev, alert_type: val }))}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    <SelectTrigger className={cn('mt-1', isRTL && 'text-right')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALERT_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-2">
                            <opt.icon className="h-4 w-4" />
                            {t(opt.labelKey)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.alert_type !== 'trend_anomaly' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className={isRTL ? 'order-last' : undefined}>
                      <Label>{t('comparison')}</Label>
                      <Select
                        value={formData.comparison}
                        onValueChange={val => setFormData(prev => ({ ...prev, comparison: val }))}
                        dir={isRTL ? 'rtl' : 'ltr'}
                      >
                        <SelectTrigger className={cn('mt-1', isRTL && 'text-right')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPARISON_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {t(opt.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={isRTL ? 'order-first' : undefined}>
                      <Label>{t('threshold')}</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={formData.threshold_value}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            threshold_value: Number(e.target.value),
                          }))
                        }
                        className={cn('mt-1', isRTL && 'text-right')}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label>{t('notificationMethod')}</Label>
                  <Select
                    value={formData.notification_method}
                    onValueChange={val =>
                      setFormData(prev => ({ ...prev, notification_method: val }))
                    }
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    <SelectTrigger className={cn('mt-1', isRTL && 'text-right')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTIFICATION_METHOD_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {error && (
                  <p className="text-sm text-destructive font-body">{error}</p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                {t('cancel')}
              </Button>
              {dialogStep === 'form' && !editingRule && (
                <Button variant="ghost" onClick={handleBackToPresets}>
                  {isRTL ? '→' : '←'} {t('choosePreset').split(' ')[0]}
                </Button>
              )}
              {dialogStep === 'form' && (
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? t('saving') : editingRule ? t('update') : t('create')}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
