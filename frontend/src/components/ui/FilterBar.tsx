import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  resultCount?: number;
  totalCount?: number;
  resultLabel?: string;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  children,
  resultCount,
  totalCount,
  resultLabel,
}: FilterBarProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-row items-center gap-3">
          <div className="relative flex-1 min-w-0 max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/50" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="ps-10"
            />
          </div>
          {children && (
            <div className="flex flex-row items-center gap-2 shrink-0">
              {children}
            </div>
          )}
        </div>
        {resultCount !== undefined && totalCount !== undefined && resultCount !== totalCount && (
          <p className="text-sm text-ink/60 mt-2 font-mono uppercase tracking-wider">
            {resultLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
