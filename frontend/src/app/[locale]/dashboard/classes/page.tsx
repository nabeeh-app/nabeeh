'use client';

import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PlusCircle,
  Search,
  Calendar,
  Clock,
  Users,
  BookOpen,
  Loader2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api';
import logger from '@/lib/logger';

export default function ClassesPage() {
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const searchParams = useSearchParams();
  const setupRequired = searchParams.get('setup') === 'required';
  const [offerings, setOfferings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const data = await apiClient.getOfferings();
      setOfferings(data);
    } catch (error) {
      logger.error('Failed to fetch classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ?
      { label: 'Active', variant: 'default' as const } :
      { label: 'Inactive', variant: 'secondary' as const };
  };

  // Flatten Offerings -> Groups
  // Each Group is a "Class" to display
  const classesList = offerings.flatMap(offering =>
    offering.groups.map((group: any) => ({
      id: group.id,
      name: group.name,
      subject: offering.subject.name_en, // Or localized
      grade: offering.grade_level.name,
      schedule: group.schedule_description,
      active: offering.is_active
    }))
  );

  return (
    <div className="space-y-6">
      {setupRequired && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-sm font-semibold">
            {isRTL ? 'مطلوب إعداد مجموعة' : 'Group setup required'}
          </p>
          <p className="text-sm text-amber-700">
            {isRTL
              ? 'أنشئ مجموعة واحدة على الأقل قبل تسجيل الحضور أو إدخال الدرجات.'
              : 'Create at least one group before taking attendance or entering grades.'}
          </p>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Class Management
          </h1>
          <p className="text-muted-foreground">
            Manage your course offerings and student groups
          </p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Class
        </Button>
      </div>

      {/* Classes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Classes List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class/Group Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Grade Level</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classesList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">No classes found.</TableCell>
                  </TableRow>
                ) : classesList.map((cls) => {
                  const status = getStatusBadge(cls.active);
                  return (
                    <TableRow key={cls.id}>
                      <TableCell className="font-medium">
                        {cls.name}
                      </TableCell>
                      <TableCell>{cls.subject}</TableCell>
                      <TableCell>{cls.grade}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {cls.schedule || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
