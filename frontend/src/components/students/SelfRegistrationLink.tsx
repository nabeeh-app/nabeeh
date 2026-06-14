'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link2, Copy, Check, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api';

interface SelfRegistrationLinkProps {
  groupId: string;
}

export default function SelfRegistrationLink({ groupId }: SelfRegistrationLinkProps) {
  const t = useTranslations('selfRegistration');
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.generateRegistrationLink(groupId);
      setLink(result.url);
      setExpiresAt(result.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const copyToClipboard = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [link]);

  const formatExpiry = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const hours = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (hours >= 24) {
      return `${Math.floor(hours / 24)} days`;
    }
    return `${hours} hours`;
  };

  return (
    <div className="space-y-4">
      {!link ? (
        <button
          onClick={generateLink}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
        >
          <Link2 className="h-4 w-4" />
          {loading ? 'Generating...' : t('generateLink')}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--color-ink)]/10 bg-[var(--color-surface)] p-3">
            <code className="flex-1 truncate text-sm text-[var(--color-ink)]">{link}</code>
            <button
              onClick={copyToClipboard}
              className="shrink-0 rounded-md p-1.5 hover:bg-[var(--color-surface-sage)]"
              title={t('copyLink')}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-[var(--color-ink)]/60" />
              )}
            </button>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md p-1.5 hover:bg-[var(--color-surface-sage)]"
            >
              <ExternalLink className="h-4 w-4 text-[var(--color-ink)]/60" />
            </a>
          </div>

          {expiresAt && (
            <p className="text-xs text-[var(--color-ink)]/50">
              {t('linkExpiry', { time: formatExpiry(expiresAt) })}
            </p>
          )}

          <button
            onClick={generateLink}
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            Generate new link
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
