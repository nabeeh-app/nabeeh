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
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          {children && (
            <div className="flex gap-2 flex-wrap">
              {children}
            </div>
          )}
        </div>
        {resultCount !== undefined && totalCount !== undefined && resultCount !== totalCount && (
          <p className="text-sm text-gray-600 mt-2">
            {resultLabel || `Showing ${resultCount} of ${totalCount}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
