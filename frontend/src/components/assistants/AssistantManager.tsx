'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Users, MoreVertical, Shield, Trash2, UserCheck, UserX, Clock, Mail, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiClient } from '@/lib/client';
import type { Assistant } from '@/types';
import { InviteForm } from './InviteForm';
import { PermissionsEditor } from './PermissionsEditor';

export function AssistantManager() {
  const t = useTranslations('assistants');
  const tCommon = useTranslations('common');
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Array<{ id: string; email: string; phone: string; status: string; expires_at: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState<Assistant | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAssistants = useCallback(async () => {
    try {
      const [assistantsRes, invitesRes] = await Promise.all([
        apiClient.getAssistants(),
        apiClient.listPendingInvites(),
      ]);
      if (assistantsRes.success && assistantsRes.data) {
        setAssistants(assistantsRes.data as Assistant[]);
      }
      if (invitesRes.success && invitesRes.data) {
        setPendingInvites(invitesRes.data as Array<{ id: string; email: string; phone: string; status: string; expires_at: string; created_at: string }>);
      }
    } catch {
      // error handled by apiClient
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssistants();
  }, [fetchAssistants]);

  const handleToggleStatus = async (assistant: Assistant) => {
    setTogglingId(assistant.id);
    try {
      const newStatus = assistant.status === 'active' ? 'inactive' : 'active';
      await apiClient.updateAssistantStatus(assistant.id, newStatus);
      setAssistants(prev =>
        prev.map(a => (a.id === assistant.id ? { ...a, status: newStatus as Assistant['status'] } : a))
      );
    } catch {
      // error handled by apiClient
    } finally {
      setTogglingId(null);
    }
  };

  const handleRemove = async () => {
    if (!removingId) return;
    try {
      await apiClient.removeAssistant(removingId);
      setAssistants(prev => prev.filter(a => a.id !== removingId));
    } catch {
      // error handled by apiClient
    } finally {
      setRemovingId(null);
    }
  };

  const handleInviteSuccess = () => {
    setShowInvite(false);
    fetchAssistants();
  };

  const handlePermissionsSaved = () => {
    setEditingPermissions(null);
    fetchAssistants();
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'inactive': return 'secondary';
      default: return 'outline';
    }
  };

  const getActivePermissionsCount = (permissions: Record<string, boolean>) => {
    return Object.values(permissions).filter(Boolean).length;
  };

  if (loading) {
    return <LoadingSpinner message={tCommon('loading')} />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('title')}
          </CardTitle>
          {assistants.length > 0 && (
            <Button onClick={() => setShowInvite(true)} size="sm">
              {t('inviteButton')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {assistants.length === 0 ? (
            <EmptyState
              icon={Users}
              message={t('emptyTitle')}
              description={t('emptyDescription')}
              actionLabel={t('inviteButton')}
              onAction={() => setShowInvite(true)}
            />
          ) : (
            <div className="space-y-3">
              {assistants.map(assistant => (
                <div
                  key={assistant.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-canvas"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-surface-sage flex items-center justify-center text-ink font-mono uppercase tracking-wider text-sm shrink-0">
                      {assistant.name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink font-body truncate">{assistant.name}</p>
                      <p className="text-sm text-ink/60 font-body truncate">{assistant.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={getStatusVariant(assistant.status) as 'success' | 'warning' | 'secondary' | 'outline'}>
                          {t(`status.${assistant.status}`)}
                        </Badge>
                        <span className="text-xs text-ink/40 font-mono">
                          {getActivePermissionsCount(assistant.permissions)} {t('permissionsLabel')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={togglingId === assistant.id}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingPermissions(assistant)}>
                        <Shield className="w-4 h-4 mr-2" />
                        {t('editPermissions')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(assistant)}>
                        {assistant.status === 'active' ? (
                          <>
                            <UserX className="w-4 h-4 mr-2" />
                            {t('deactivate')}
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 mr-2" />
                            {t('activate')}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setRemovingId(assistant.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('remove')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 shrink-0" />
              <span className="flex-1">{t('pendingInvites')}</span>
              <Badge variant="secondary">{pendingInvites.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingInvites.map(invite => (
                <div key={invite.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-canvas">
                  <div className="w-8 h-8 rounded-full bg-surface-sage flex items-center justify-center shrink-0">
                    {invite.email ? <Mail className="w-4 h-4 text-ink/60" /> : <Smartphone className="w-4 h-4 text-ink/60" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body text-ink truncate">{invite.email || invite.phone}</p>
                    <p className="text-xs text-ink/40 font-body">
                      {t('expires')} {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="warning" className="shrink-0">{t('status.pending')}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showInvite && (
        <InviteForm
          onClose={() => setShowInvite(false)}
          onSuccess={handleInviteSuccess}
        />
      )}

      {editingPermissions && (
        <PermissionsEditor
          assistant={editingPermissions}
          onClose={() => setEditingPermissions(null)}
          onSave={handlePermissionsSaved}
        />
      )}

      <AlertDialog open={!!removingId} onOpenChange={() => setRemovingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('removeConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-white">
              {t('remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
