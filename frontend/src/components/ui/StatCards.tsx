import { LucideIcon } from 'lucide-react';

type StatColor = 'primary' | 'success' | 'warning' | 'destructive' | 'accent';

const bgMap: Record<StatColor, string> = {
  primary: 'bg-surface-sage',
  success: 'bg-surface-sage',
  warning: 'bg-surface-cool',
  destructive: 'bg-destructive/10',
  accent: 'bg-surface-cool',
};

const textMap: Record<StatColor, string> = {
  primary: 'text-primary',
  success: 'text-primary',
  warning: 'text-ink/60',
  destructive: 'text-destructive',
  accent: 'text-ink/70',
};

interface StatCardData {
  icon: LucideIcon;
  value: string | number;
  label: string;
  color?: StatColor;
}

interface StatCardsProps {
  stats: StatCardData[];
}

export function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const color = stat.color || 'primary';
        return (
          <div key={index} className={`${bgMap[color]} p-4 rounded-md`}>
            <div className="flex items-center gap-2">
              <stat.icon className={`h-8 w-8 ${textMap[color]}`} />
              <div>
                <p className="text-2xl font-bold font-display">{stat.value}</p>
                <p className="text-sm text-ink/60 font-body uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface SingleStatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
}

export function StatCard({ title, value, icon }: SingleStatCardProps) {
  const Icon = icon;
  return (
    <div className="bg-surface-sage p-5 rounded-md">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink/50 truncate font-body uppercase tracking-wider">
            {title}
          </p>
          <p className="text-3xl font-bold text-ink font-display leading-tight">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
