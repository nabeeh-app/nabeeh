'use client';

import { useRef, ReactNode } from 'react';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

interface VirtualTableBodyProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  rowHeight?: number;
  estimateSize?: (index: number) => number;
  children: (virtualItems: VirtualItem[]) => ReactNode;
}

export function VirtualTableBody<T>({
  items,
  renderItem,
  className,
  rowHeight = 48,
  estimateSize,
  children,
}: VirtualTableBodyProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateSize || (() => rowHeight),
    overscan: 5,
  });

  return (
    <div ref={parentRef} className={cn('overflow-auto', className)}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {children(virtualizer.getVirtualItems())}
      </div>
    </div>
  );
}

interface VirtualTableRowProps {
  virtualRow: {
    key: string | number;
    index: number;
    start: number;
    size: number;
  };
  children: ReactNode;
  className?: string;
}

export function VirtualTableRow({
  virtualRow,
  children,
  className,
}: VirtualTableRowProps) {
  return (
    <div
      className={cn('absolute w-full', className)}
      style={{
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      {children}
    </div>
  );
}