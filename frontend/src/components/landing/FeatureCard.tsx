import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <Card className="border-ink/10 bg-canvas hover:border-primary/30 transition-colors h-full">
      <CardContent className="p-6 flex flex-col h-full">
        <div className="w-10 h-10 rounded-lg bg-surface-sage flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-ink font-display mb-2">{title}</h3>
        <p className="text-sm text-ink/60 font-body leading-relaxed mt-auto">{description}</p>
      </CardContent>
    </Card>
  );
}
