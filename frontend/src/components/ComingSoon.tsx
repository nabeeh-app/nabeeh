import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type ComingSoonProps = {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  badgeLabel?: string;
};

export default function ComingSoon({
  title,
  description,
  backHref,
  backLabel,
  badgeLabel = 'Coming soon',
}: ComingSoonProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-3 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {badgeLabel}
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button asChild className="mt-2">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
