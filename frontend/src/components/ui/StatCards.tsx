import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type StatColor = 'primary' | 'success' | 'warning' | 'destructive' | 'accent';

const colorMap: Record<StatColor, string> = {
  primary: 'text-primary',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  destructive: 'text-destructive',
  accent: 'text-purple-600 dark:text-purple-400',
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
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <stat.icon className={`h-8 w-8 ${colorMap[stat.color || 'primary']}`} />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
