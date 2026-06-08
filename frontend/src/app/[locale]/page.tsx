
import { redirect } from '@/i18n/routing';

type Props = {
    params: Promise<{ locale: string }>;
};

export default async function LocalePage({ params }: Props) {
    const { locale } = await params;

    // Redirect to login page
    redirect({ href: '/login', locale: locale });
}
