import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
}

export function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="text-center py-8">
      <Icon className="h-12 w-12 text-ink/40 mx-auto mb-4" />
      <p className="text-ink/60 font-body">{message}</p>
    </div>
  );
}
