import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  message,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="rounded-full bg-surface-cool p-5 mb-5">
        <Icon className="h-10 w-10 text-ink/30" />
      </div>
      <h3 className="text-lg font-semibold text-ink font-display mb-1">
        {message}
      </h3>
      {description && (
        <p className="text-sm text-ink/50 font-body max-w-sm text-center mb-5">
          {description}
        </p>
      )}
      {(actionLabel && onAction) && (
        <div className="flex gap-3">
          <Button onClick={onAction} className="gap-2">
            {actionLabel}
          </Button>
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
