import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  locale?: string;
}

export function Pagination({ page, totalPages, onPageChange, locale }: PaginationProps) {
  const labels = locale === 'ar'
    ? { pagination: 'التنقل بين الصفحات', previous: 'الصفحة السابقة', next: 'الصفحة التالية' }
    : { pagination: 'Pagination', previous: 'Previous page', next: 'Next page' };
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <nav className="flex items-center justify-center gap-1 mt-4 font-body" aria-label={labels.pagination}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-2 rounded-lg text-ink/60 hover:bg-accent/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        aria-label={labels.previous}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-ink/40 text-sm">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
              p === page
                ? 'bg-primary text-white'
                : 'text-ink/60 hover:bg-accent/10'
            }`}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="p-2 rounded-lg text-ink/60 hover:bg-accent/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        aria-label={labels.next}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
