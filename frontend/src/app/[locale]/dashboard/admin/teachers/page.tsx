'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminTeachersPage() {
  const { teacher } = useAuth();
  const t = useTranslations('admin.teachers');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'teacher' as 'teacher' | 'admin'
  });
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!teacher || teacher.role !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('accessDenied')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t('accessDeniedDescription')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);
    try {
      await apiClient.createTeacherAccount(form);
      setStatus(t('createSuccess'));
      setForm({
        name: '',
        email: '',
        password: '',
        role: 'teacher'
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      setStatus(err.response?.data?.message || err.message || t('createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('createTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
              />
            </div>
            <div>
              <Label>{t('role')}</Label>
              <Select value={form.role} onValueChange={(value) => handleChange('role', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">{t('teacherOption')}</SelectItem>
                  <SelectItem value="admin">{t('adminOption')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {status && (
              <p className="text-sm text-ink/60">{status}</p>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('creating') : t('create')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
