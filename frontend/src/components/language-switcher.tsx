'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLanguage = () => {
    const newLocale = locale === 'en' ? 'ar' : 'en';
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={switchLanguage}
      className={cn("gap-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent", className)}
      title={locale === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
    >
      <Globe className="h-4 w-4" />
      <span className="text-sm font-medium">
        {locale === 'en' ? 'عربي' : 'English'}
      </span>
    </Button>
  );
}
