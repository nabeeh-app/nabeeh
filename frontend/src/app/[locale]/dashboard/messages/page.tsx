'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import SendMessageModal from '@/components/SendMessageModal';
import { apiClient } from '@/lib/client';
import { getStatusBadge } from '@/lib/utils';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';
import { Conversation, Message } from '@/types';
import { MessageCircle, RefreshCw, Search, Send } from 'lucide-react';

type SendStatus = {
  type: 'success' | 'error';
  message: string;
};

const formatDateTime = (value: string, locale: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getConversationLabel = (conversation: Conversation, fallback: string) => {
  if (conversation.parent_name) {
    return conversation.parent_name;
  }
  if (conversation.parent_phone) {
    return conversation.parent_phone;
  }
  return fallback;
};

const getConversationSubtitle = (conversation: Conversation) => {
  if (conversation.student_name) {
    return conversation.student_name;
  }
  return conversation.parent_phone || '';
};

const getInitials = (label: string) => {
  const parts = label.split(' ').filter(Boolean);
  if (parts.length === 0) {
    return '--';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export default function MessagesPage() {
  const t = useTranslations('messages');
  const tWhatsApp = useTranslations('whatsapp');
  const locale = useLocale();
  const badgeLocale = locale === 'ar' ? 'ar' : 'en';

  const { whatsappStatus } = useWhatsAppStatus(undefined, true);
  const isWhatsAppConnected = whatsappStatus.status === 'connected';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSendModalOpen, setSendModalOpen] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);

  const filteredConversations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return conversations;
    }
    return conversations.filter(conversation => {
      const fields = [
        conversation.parent_name,
        conversation.parent_phone,
        conversation.student_name,
        conversation.latest_message
      ];
      return fields.some(field => field?.toLowerCase().includes(term));
    });
  }, [conversations, searchTerm]);

  const selectedConversation = conversations.find(conversation => conversation.id === selectedConversationId) || null;
  const selectedStatusBadge = selectedConversation
    ? getStatusBadge(selectedConversation.is_active ? 'active' : 'inactive', badgeLocale)
    : null;

  const loadConversations = useCallback(async () => {
    try {
      setIsLoadingConversations(true);
      setError(null);

      const response = await apiClient.getConversations({ page: 1, limit: 50 });
      const nextConversations = response.data ?? [];
      setConversations(nextConversations);

      setSelectedConversationId(prev => {
        if (prev && nextConversations.some(conversation => conversation.id === prev)) {
          return prev;
        }
        return nextConversations[0]?.id ?? null;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(message);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      setIsLoadingMessages(true);
      setError(null);

      const response = await apiClient.getConversationMessages(conversationId, { page: 1, limit: 50 });
      setMessages(response.data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load messages';
      setError(message);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const handleSendMessage = async (phone: string, message: string) => {
    setSendStatus(null);
    try {
      await apiClient.sendMessage({ phone, message });
      setSendStatus({ type: 'success', message: t('sendSuccess') });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setSendStatus({ type: 'error', message: errorMessage });
      throw err;
    }
  };

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedConversationId);
  }, [selectedConversationId, loadMessages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-ink/60">{t('messageHistory')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={loadConversations}
            disabled={isLoadingConversations}
            className="flex items-center gap-2"
          >
            <RefreshCw className={isLoadingConversations ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {t('recheckStatus')}
          </Button>
          <Button
            onClick={() => setSendModalOpen(true)}
            disabled={!isWhatsAppConnected}
            className="flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            {t('sendMessage')}
          </Button>
        </div>
      </div>

      {!isWhatsAppConnected && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-surface-sage p-4 rounded-md">
          <div>
            <p className="text-base font-medium text-ink">{tWhatsApp('statusDisconnectedTitle')}</p>
            <p className="text-sm text-ink/60">
              {whatsappStatus.message || tWhatsApp('statusDisconnectedDescription')}
            </p>
          </div>
          <Button asChild>
            <a href={`/${locale}/dashboard/whatsapp`}>{tWhatsApp('connectWhatsApp')}</a>
          </Button>
        </div>
      )}

      {sendStatus && (
        <div className={`p-4 rounded-md text-sm ${sendStatus.type === 'success' ? 'bg-surface-sage text-ink' : 'bg-[#c53030]/10 text-[#c53030]'}`}>
          {sendStatus.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">{t('conversations')}</CardTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('recipient')}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingConversations ? (
              <p className="text-sm text-ink/60">{t('checkingStatus')}</p>
            ) : filteredConversations.length === 0 ? (
              <p className="text-sm text-ink/60">{t('noMessages')}</p>
            ) : (
              filteredConversations.map(conversation => {
                const label = getConversationLabel(conversation, t('unknown'));
                const subtitle = getConversationSubtitle(conversation);
                const isActive = conversation.id === selectedConversationId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${isActive ? 'border-primary bg-primary/5' : 'border-ink/20 hover:bg-surface-cool/30'}`}
                  >
                    <Avatar>
                      <AvatarFallback>{getInitials(label)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{label}</p>
                        {conversation.message_count !== undefined && (
                          <Badge variant="secondary">{conversation.message_count}</Badge>
                        )}
                      </div>
                      {subtitle && <p className="text-xs text-ink/60">{subtitle}</p>}
                      {conversation.latest_message && (
                        <p className="text-xs text-ink/60 line-clamp-1">{conversation.latest_message}</p>
                      )}
                      {conversation.last_message_at && (
                        <p className="text-[11px] text-ink/60">
                          {formatDateTime(conversation.last_message_at, locale)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t('messageHistory')}</CardTitle>
              {selectedConversation && (
                <p className="text-sm text-ink/60">
                  {getConversationLabel(selectedConversation, t('unknown'))}
                </p>
              )}
            </div>
            {selectedConversation && (
              <Badge variant={selectedStatusBadge?.variant}>
                {selectedStatusBadge?.label}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg border border-[#c53030]/20 bg-[#c53030]/10 p-3 text-sm text-[#c53030]">
                {error}
              </div>
            )}
            {isLoadingMessages ? (
              <p className="text-sm text-ink/60">{t('checkingStatus')}</p>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink/60">
                <MessageCircle className="h-8 w-8" />
                {t('noMessages')}
              </div>
            ) : (
              <div className="flex max-h-[520px] flex-col gap-3 overflow-y-auto pr-2">
                {messages.map(message => {
                  const isFromParent = message.is_from_parent;
                  return (
                    <div
                      key={message.id}
                      className={`flex flex-col gap-1 ${isFromParent ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isFromParent ? 'bg-surface-cool text-ink' : 'bg-primary text-primary-foreground'}`}
                      >
                        <p>{message.content}</p>
                        {message.message_type !== 'text' && (
                          <p className="mt-1 text-[11px] opacity-80">
                            {message.message_type}
                          </p>
                        )}
                      </div>
                      <p className="text-[11px] text-ink/60">
                        {message.sender_name || message.sender_phone}
                        {' · '}
                        {formatDateTime(message.created_at, locale)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SendMessageModal
        isOpen={isSendModalOpen}
        onClose={() => setSendModalOpen(false)}
        onSend={handleSendMessage}
        isRTL={locale === 'ar'}
      />
    </div>
  );
}
