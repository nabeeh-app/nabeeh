import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ViewMode {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface ViewModeTabsProps {
  modes: ViewMode[];
  active: string;
  onChange: (mode: string) => void;
}

export function ViewModeTabs({ modes, active, onChange }: ViewModeTabsProps) {
  return (
    <div
      className="flex items-center space-x-1 bg-muted p-1 rounded-lg w-fit"
      role="tablist"
    >
      {modes.map((mode) => (
        <Button
          key={mode.id}
          variant={active === mode.id ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onChange(mode.id)}
          role="tab"
          aria-selected={active === mode.id}
        >
          <mode.icon className="w-4 h-4 me-2" />
          {mode.label}
        </Button>
      ))}
    </div>
  );
}
