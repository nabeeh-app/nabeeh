import { LucideIcon } from 'lucide-react';

type StatColor = 'primary' | 'success' | 'warning' | 'destructive' | 'accent';

const bgMap: Record<StatColor, string> = {
  primary: 'bg-surface-sage',
  success: 'bg-surface-sage',
  warning: 'bg-surface-cool',
  destructive: 'bg-[#c53030]/10',
  accent: 'bg-surface-cool',
};

const textMap: Record<StatColor, string> = {
  primary: 'text-primary',
  success: 'text-[#026370]',
  warning: 'text-ink/60',
  destructive: 'text-destructive',
  accent: 'text-ink/70',
};

interface StatCard {
  icon: LucideIcon;
  value: string | number;
  label: string;
  color?: StatColor;
}

interface StatCardsProps {
  stats: StatCard[];
}

export function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const color = stat.color || 'primary';
        return (
          <div key={index} className={`${bgMap[color]} p-4 rounded-md`}>
            <div className="flex items-center space-x-2">
              <stat.icon className={`h-8 w-8 ${textMap[color]}`} />
              <div>
                <p className="text-2xl font-bold font-display">{stat.value}</p>
                <p className="text-sm text-ink/60 font-mono uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
