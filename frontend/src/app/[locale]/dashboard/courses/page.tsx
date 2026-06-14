'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import logger from '@/lib/logger';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  BookOpen,
  Users,
  GraduationCap,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useOfferings, useDeleteOffering, useCreateGroup } from '@/hooks/useOfferings';
import { Offering } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatCards } from '@/components/ui/StatCards';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CoursesPage() {
  const t = useTranslations();
  const locale = useLocale();

  const { data: offerings = [], isLoading: loading } = useOfferings();
  const deleteOffering = useDeleteOffering();
  const createGroup = useCreateGroup();

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOffering, setExpandedOffering] = useState<string | null>(null);
  const [isAddGroupOpen, setAddGroupOpen] = useState(false);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSchedule, setNewGroupSchedule] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [alertDialog, setAlertDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const filteredOfferings = offerings.filter((o) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.subject.name_en.toLowerCase().includes(term) ||
      o.subject.name_ar.includes(searchTerm) ||
      o.grade_level.name.toLowerCase().includes(term)
    );
  });

  const totalGroups = offerings.reduce((sum, o) => sum + o.groups.length, 0);
  const totalEnrolled = offerings.reduce((sum, o) => sum + o.groups.length, 0);

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferingId || !newGroupName.trim()) {
      setFormError(t('courses.groupName') + ' is required');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      await createGroup.mutateAsync({
        offeringId: selectedOfferingId,
        data: {
          name: newGroupName.trim(),
          schedule_description: newGroupSchedule.trim() || null,
        },
      });
      setAddGroupOpen(false);
      setNewGroupName('');
      setNewGroupSchedule('');
      setSelectedOfferingId(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create group';
      setFormError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOffering = (offering: Offering) => {
    setAlertDialog({
      open: true,
      title: t('common.delete'),
      description: locale === 'ar'
        ? `هل أنت متأكد من حذف عرض ${offering.subject.name_ar}؟`
        : `Are you sure you want to delete ${offering.subject.name_en}?`,
      onConfirm: async () => {
        try {
          await deleteOffering.mutateAsync(offering.id);
        } catch (err: unknown) {
          logger.error('Error deleting offering', err);
        }
      },
    });
  };

  if (loading) {
    return <LoadingSpinner message={t('courses.loading')} />;
  }

  const stats = [
    { icon: BookOpen, value: offerings.length, label: t('courses.totalOfferings'), color: 'primary' as const },
    { icon: GraduationCap, value: totalGroups, label: t('courses.totalGroups'), color: 'accent' as const },
    { icon: Users, value: totalEnrolled, label: t('courses.totalEnrolled'), color: 'success' as const },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('courses.title')}
        description={t('courses.description')}
      />

      <StatCards stats={stats} />

      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('courses.searchPlaceholder')}
        resultCount={filteredOfferings.length}
        totalCount={offerings.length}
        resultLabel={locale === 'ar'
          ? `عرض ${filteredOfferings.length} من ${offerings.length} عرض`
          : `Showing ${filteredOfferings.length} of ${offerings.length} offerings`}
      />

      {filteredOfferings.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          message={searchTerm ? t('courses.noOfferings') : t('courses.noOfferingsDescription')}
        />
      ) : (
        <div className="space-y-3">
          {filteredOfferings.map((offering) => {
            const isExpanded = expandedOffering === offering.id;
            const subjectName = locale === 'ar' ? offering.subject.name_ar : offering.subject.name_en;

            return (
              <Card key={offering.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-cool/50 transition-colors"
                  onClick={() => setExpandedOffering(isExpanded ? null : offering.id)}
                >
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <BookOpen className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{subjectName}</div>
                      <div className="text-sm text-ink/60">
                        {offering.grade_level.name}
                        {offering.academic_year && ` · ${offering.academic_year}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={offering.is_active ? 'default' : 'secondary'}>
                      {offering.is_active ? t('courses.active') : t('courses.inactive')}
                    </Badge>
                    <Badge variant="outline">
                      {offering.groups.length} {t('courses.groups')}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOfferingId(offering.id);
                          setAddGroupOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOffering(offering);
                        }}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-4 pb-4">
                    {offering.groups.length === 0 ? (
                      <div className="py-6 text-center text-ink/60">
                        <p className="font-body">{t('courses.noGroups')}</p>
                        <p className="text-sm mt-1">{t('courses.noGroupsDescription')}</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('courses.groupName')}</TableHead>
                            <TableHead>{t('courses.schedule')}</TableHead>
                            <TableHead>{t('courses.students')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {offering.groups.map((group) => (
                            <TableRow key={group.id}>
                              <TableCell className="font-medium">{group.name}</TableCell>
                              <TableCell className="text-ink/60">
                                {group.schedule_description || '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  <Users className="h-3 w-3 mr-1" />
                                  0
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Group Dialog */}
      <Dialog open={isAddGroupOpen} onOpenChange={setAddGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('courses.addGroup')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddGroup} className="space-y-4">
            <div>
              <Label htmlFor="groupName">{t('courses.groupName')} *</Label>
              <Input
                id="groupName"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t('courses.groupNamePlaceholder')}
                required
              />
            </div>
            <div>
              <Label htmlFor="schedule">{t('courses.schedule')}</Label>
              <Input
                id="schedule"
                value={newGroupSchedule}
                onChange={(e) => setNewGroupSchedule(e.target.value)}
                placeholder={t('courses.schedulePlaceholder')}
              />
            </div>
            {formError && (
              <div className="text-[#c53030] text-sm bg-[#c53030]/10 p-3 rounded">
                {formError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddGroupOpen(false)}
                disabled={submitting}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                alertDialog.onConfirm();
                setAlertDialog((prev) => ({ ...prev, open: false }));
              }}
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
