'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { formatPhoneNumber, validateEmail } from '@/lib/utils';
import { 
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Save,
  Upload,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Languages,
  CheckCircle,
  XCircle,
  Loader2,
  MessageSquare
} from 'lucide-react';
import apiClient from '@/lib/api';

interface TeacherSettings {
  name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  business_name: string;
  bio: string;
  subjects: string[];
  address: string;
  city: string;
  country: string;
  timezone: string;
  telegram_username: string;
}

export default function SettingsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const { teacher, updateProfile } = useAuth();
  const isRTL = locale === 'ar';

  const [settings, setSettings] = useState<TeacherSettings>({
    name: '',
    email: '',
    phone: '',
    whatsapp_number: '',
    business_name: '',
    bio: '',
    subjects: [],
    address: '',
    city: '',
    country: 'Egypt',
    timezone: 'Africa/Cairo',
    telegram_username: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load teacher data on component mount
  useEffect(() => {
    if (teacher) {
      setSettings({
        name: teacher.name || '',
        email: teacher.email || '',
        phone: teacher.phone || '',
        whatsapp_number: teacher.whatsapp_number || teacher.phone || '',
        business_name: teacher.business_name || '',
        bio: teacher.bio || '',
        subjects: teacher.subjects || [],
        address: teacher.address || '',
        city: teacher.city || '',
        country: teacher.country || 'Egypt',
        timezone: teacher.timezone || 'Africa/Cairo',
        telegram_username: teacher.telegram_username || ''
      });
    }
  }, [teacher]);

  // Check WhatsApp connection status
  useEffect(() => {
    checkWhatsAppStatus();
  }, [settings.whatsapp_number]);

  const checkWhatsAppStatus = async () => {
    if (!settings.whatsapp_number) {
      setWhatsappStatus('disconnected');
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage(''); // Clear previous messages
      // Use API client with proper authentication
      const response = await apiClient.api.post('/whatsapp/status', {
        phone: settings.whatsapp_number
      });

      if (response.data.success) {
        setWhatsappStatus(response.data.data?.status || 'disconnected');

        // Show detailed status message based on the actual response
        if (response.data.data?.status === 'connected') {
          if (response.data.message?.includes('partially connected')) {
            setStatusMessage('✅ الواتساب متصل جزئياً. يُفضل إكمال الإعداد للاستقرار الكامل.');
          } else {
            setStatusMessage('✅ الواتساب متصل بنجاح! يمكنك الآن إرسال الرسائل.');
          }
        } else if (response.data.data?.status === 'disconnected') {
          setStatusMessage(response.data.message || '📱 الواتساب غير متصل. يمكنك طلب رمز الربط للبدء.');
        } else if (response.data.data?.status === 'invalid_number') {
          setStatusMessage('❌ رقم الهاتف غير مسجل في الواتساب.');
        } else {
          setStatusMessage(response.data.message || '');
        }
      } else {
        setWhatsappStatus('disconnected');
        setStatusMessage(response.data.message || 'فشل في التحقق من حالة الواتساب');
      }
    } catch (error: any) {
      console.error('WhatsApp status check failed:', error);
      // Don't set to 'unknown' on errors, just keep current status
      if (error.response?.status === 401) {
        // Token expired, let the auth interceptor handle it
        console.log('Token expired, redirecting to login');
      } else {
        setWhatsappStatus('disconnected');
        setStatusMessage('فشل في التحقق من حالة الواتساب');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!settings.name.trim()) {
      newErrors.name = isRTL ? 'الاسم مطلوب' : 'Name is required';
    }

    if (!settings.email.trim()) {
      newErrors.email = isRTL ? 'البريد الإلكتروني مطلوب' : 'Email is required';
    } else if (!validateEmail(settings.email)) {
      newErrors.email = isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email format';
    }

    if (!settings.phone.trim()) {
      newErrors.phone = isRTL ? 'رقم الهاتف مطلوب' : 'Phone number is required';
    } else if (!/^\+\d{10,15}$/.test(settings.phone)) {
      newErrors.phone = isRTL ? 'رقم الهاتف غير صحيح' : 'Invalid phone number format';
    }

    if (settings.whatsapp_number && !/^\+\d{10,15}$/.test(settings.whatsapp_number)) {
      newErrors.whatsapp_number = isRTL ? 'رقم الواتساب غير صحيح' : 'Invalid WhatsApp number format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof TeacherSettings, value: string | string[]) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePhoneChange = (field: 'phone' | 'whatsapp_number', value: string) => {
    const formatted = formatPhoneNumber(value);
    handleInputChange(field, formatted);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const updateData = {
        name: settings.name.trim(),
        phone: settings.phone,
        whatsapp_number: settings.whatsapp_number || settings.phone,
        business_name: settings.business_name.trim(),
        bio: settings.bio.trim(),
        subjects: settings.subjects.filter(Boolean),
        address: settings.address.trim(),
        city: settings.city.trim(),
        country: settings.country,
        timezone: settings.timezone,
        telegram_username: settings.telegram_username.trim()
      };

      await updateProfile(updateData);

      setMessage({
        type: 'success',
        text: isRTL ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully'
      });

      // Recheck WhatsApp status if number changed
      checkWhatsAppStatus();
    } catch (error: any) {
      console.error('Save settings error:', error);
      setMessage({
        type: 'error',
        text: error?.response?.data?.message || (isRTL ? 'خطأ في الاتصال بالخادم' : 'Network error. Please try again.')
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getWhatsAppStatusBadge = () => {
    switch (whatsappStatus) {
      case 'connected':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            {isRTL ? 'متصل' : 'Connected'}
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            {isRTL ? 'غير متصل' : 'Disconnected'}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {isLoading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : null}
            {isRTL ? 'غير معروف' : 'Unknown'}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isRTL ? 'الإعدادات' : 'Settings'}
          </h1>
          <p className="text-muted-foreground">
            {isRTL 
              ? 'إدارة إعدادات الحساب والتفضيلات' 
              : 'Manage account settings and preferences'
            }
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isRTL ? 'حفظ الإعدادات' : 'Save Settings'}
        </Button>
      </div>

      {/* Success/Error Messages */}
      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-100 border border-green-400 text-green-700' 
            : 'bg-red-100 border border-red-400 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {isRTL ? 'المعلومات الشخصية' : 'Profile Information'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Profile Picture */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src="/avatars/teacher.jpg" />
                <AvatarFallback className="text-lg">
                  {settings.name.split(' ').map(n => n[0]).join('').toUpperCase() || 'T'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  {isRTL ? 'تحديث الصورة' : 'Upload Photo'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'JPG أو PNG حتى 2MB' : 'JPG or PNG up to 2MB'}
                </p>
              </div>
            </div>

            {/* Personal Information */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  {isRTL ? 'الاسم الكامل *' : 'Full Name *'}
                </Label>
                <Input
                  id="fullName"
                  value={settings.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`${isRTL ? 'text-right' : ''} ${errors.name ? 'border-red-500' : ''}`}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">
                  {isRTL ? 'البريد الإلكتروني *' : 'Email *'}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">
                  {isRTL ? 'رقم الهاتف *' : 'Phone Number *'}
                </Label>
                <Input
                  id="phone"
                  value={settings.phone}
                  onChange={(e) => handlePhoneChange('phone', e.target.value)}
                  placeholder="+201234567890"
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessName">
                  {isRTL ? 'اسم المؤسسة التعليمية' : 'Institution Name'}
                </Label>
                <Input
                  id="businessName"
                  value={settings.business_name}
                  onChange={(e) => handleInputChange('business_name', e.target.value)}
                  className={isRTL ? 'text-right' : ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">
                {isRTL ? 'نبذة تعريفية' : 'Bio'}
              </Label>
              <Textarea
                id="bio"
                value={settings.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder={isRTL ? 'اكتب نبذة مختصرة عنك...' : 'Write a short bio about yourself...'}
                className={isRTL ? 'text-right' : ''}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subjects">
                {isRTL ? 'المواد التي تدرسها' : 'Subjects You Teach'}
              </Label>
              <Input
                id="subjects"
                value={settings.subjects.join(', ')}
                onChange={(e) => handleInputChange('subjects', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder={isRTL ? 'الرياضيات، الفيزياء، الكيمياء' : 'Mathematics, Physics, Chemistry'}
                className={isRTL ? 'text-right' : ''}
              />
            </div>
          </CardContent>
        </Card>

                 {/* Contact Preferences */}
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Bell className="h-5 w-5" />
               {isRTL ? 'تفضيلات التواصل' : 'Communication Preferences'}
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="grid gap-4">
               <div className="space-y-2">
                 <Label htmlFor="whatsapp" className="flex items-center gap-2">
                   <Phone className="h-4 w-4" />
                   {isRTL ? 'رقم الواتساب' : 'WhatsApp Number'}
                 </Label>
                 <Input
                   id="whatsapp"
                   value={settings.whatsapp_number}
                   onChange={(e) => handlePhoneChange('whatsapp_number', e.target.value)}
                   placeholder={settings.phone || "+201234567890"}
                   className={`${errors.whatsapp_number ? 'border-red-500' : ''}`}
                 />
                 {errors.whatsapp_number && <p className="text-sm text-red-500">{errors.whatsapp_number}</p>}
                 <p className="text-xs text-gray-500">
                   {isRTL ? 'اتركه فارغاً لاستخدام نفس رقم الهاتف' : 'Leave empty to use same as phone number'}
                 </p>
               </div>
               
               <div className="space-y-2">
                 <Label htmlFor="telegram" className="flex items-center gap-2">
                   <Phone className="h-4 w-4" />
                   {isRTL ? 'اسم المستخدم في تليجرام' : 'Telegram Username'}
                 </Label>
                 <Input
                   id="telegram"
                   value={settings.telegram_username}
                   onChange={(e) => handleInputChange('telegram_username', e.target.value)}
                   placeholder="@username"
                 />
               </div>
             </div>
           </CardContent>
         </Card>

         {/* WhatsApp Setup - Simplified */}
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <MessageSquare className="h-5 w-5" />
               {isRTL ? 'إعداد الواتساب' : 'WhatsApp Setup'}
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
               <span className="text-sm font-medium">
                 {isRTL ? 'الحالة:' : 'Status:'}
               </span>
               <div className="flex items-center gap-2">
                 {whatsappStatus === 'connected' ? (
                   <CheckCircle className="w-4 h-4 text-green-500" />
                 ) : (
                   <XCircle className="w-4 h-4 text-red-500" />
                 )}
                 <Badge variant={whatsappStatus === 'connected' ? 'default' : 'destructive'}>
                   {whatsappStatus === 'connected' 
                     ? (isRTL ? 'متصل' : 'Connected')
                     : (isRTL ? 'غير متصل' : 'Disconnected')
                   }
                 </Badge>
               </div>
             </div>
             
              <div className="text-sm text-gray-600">
                {isRTL 
                  ? 'لإعداد الواتساب، افتح لوحة التحكم وامسح رمز QR'
                  : 'To setup WhatsApp, open the dashboard and scan QR code'
                }
              </div>
           </CardContent>
         </Card>

         {/* Notification Preferences */}
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Bell className="h-5 w-5" />
               {isRTL ? 'تفضيلات الإشعارات' : 'Notification Preferences'}
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="space-y-2">
               {[
                 { label: isRTL ? 'إشعارات الحضور' : 'Attendance notifications', enabled: true },
                 { label: isRTL ? 'إشعارات الدرجات' : 'Grade notifications', enabled: true },
                 { label: isRTL ? 'رسائل أولياء الأمور' : 'Parent messages', enabled: true },
                 { label: isRTL ? 'تذكيرات الواجبات' : 'Assignment reminders', enabled: false },
                 { label: isRTL ? 'إشعارات النظام' : 'System notifications', enabled: true }
               ].map((item, index) => (
                 <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                   <span className="text-sm">{item.label}</span>
                   <Badge variant={item.enabled ? 'default' : 'secondary'}>
                     {item.enabled ? (isRTL ? 'مفعل' : 'Enabled') : (isRTL ? 'معطل' : 'Disabled')}
                   </Badge>
                 </div>
               ))}
             </div>
           </CardContent>
         </Card>

        {/* Location & Timezone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {isRTL ? 'الموقع والوقت' : 'Location & Time'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">
                  {isRTL ? 'المدينة' : 'City'}
                </Label>
                <Input
                  id="city"
                  value={settings.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className={isRTL ? 'text-right' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">
                  {isRTL ? 'الدولة' : 'Country'}
                </Label>
                <Input
                  id="country"
                  value={settings.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className={isRTL ? 'text-right' : ''}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">
                {isRTL ? 'العنوان' : 'Address'}
              </Label>
              <Textarea
                id="address"
                value={settings.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder={isRTL ? 'العنوان الكامل' : 'Full address'}
                className={isRTL ? 'text-right' : ''}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {isRTL ? 'المنطقة الزمنية' : 'Timezone'}
              </Label>
              <select
                id="timezone"
                value={settings.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Africa/Cairo">Africa/Cairo (GMT+2)</option>
                <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                <option value="Europe/London">Europe/London (GMT+0)</option>
                <option value="America/New_York">America/New_York (GMT-5)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Language & Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              {isRTL ? 'اللغة والتفضيلات' : 'Language & Preferences'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="language">
                {isRTL ? 'لغة الواجهة' : 'Interface Language'}
              </Label>
              <select
                id="language"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue={locale}
              >
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">
                {isRTL ? 'المظهر' : 'Theme'}
              </Label>
              <select
                id="theme"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="light">{isRTL ? 'فاتح' : 'Light'}</option>
                <option value="dark">{isRTL ? 'داكن' : 'Dark'}</option>
                <option value="system">{isRTL ? 'حسب النظام' : 'System'}</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* WhatsApp connection is now handled in the main settings above */}
    </div>
  );
}
