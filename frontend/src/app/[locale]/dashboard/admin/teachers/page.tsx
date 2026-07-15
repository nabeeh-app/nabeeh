'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminTeachersPage() {
  const { teacher } = useAuth();
  const locale = useLocale();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'teacher' as 'teacher' | 'admin'
  });
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRTL = locale === 'ar';

  if (!teacher || teacher.role !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'الدخول مرفوض' : 'Access denied'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{isRTL ? 'هذه الصفحة مخصصة للمسؤولين فقط.' : 'This page is restricted to administrators.'}</p>
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
      setStatus(isRTL ? 'تم إنشاء حساب المعلم بنجاح.' : 'Teacher account created successfully.');
      setForm({
        name: '',
        email: '',
        password: '',
        role: 'teacher'
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      setStatus(err.response?.data?.message || err.message || (isRTL ? 'فشل في إنشاء حساب المعلم.' : 'Failed to create teacher account.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? 'إنشاء حساب معلم' : 'Create Teacher Account'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">{isRTL ? 'الاسم' : 'Name'}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">{isRTL ? 'كلمة المرور' : 'Password'}</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
              />
            </div>
            <div>
              <Label>{isRTL ? 'الدور' : 'Role'}</Label>
              <Select value={form.role} onValueChange={(value) => handleChange('role', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">{isRTL ? 'معلم' : 'Teacher'}</SelectItem>
                  <SelectItem value="admin">{isRTL ? 'مسؤول' : 'Admin'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {status && (
              <p className="text-sm text-ink/60">{status}</p>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنشاء' : 'Create')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
