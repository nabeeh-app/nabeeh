'use client';

import { useTranslations } from 'next-intl';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqKeys = ['what', 'whatsapp', 'pricing', 'setup', 'data', 'support'] as const;

export function FAQSection() {
  const t = useTranslations('landing.faq');
  const tQ = useTranslations('landing.faq.questions');

  return (
    <section id="faq" className="py-20 bg-surface-sage/50 scroll-mt-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-ink font-display mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-ink/60 font-body">{t('subtitle')}</p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqKeys.map((key) => (
            <AccordionItem
              key={key}
              value={key}
              className="bg-canvas border border-ink/10 rounded-xl px-4 overflow-hidden data-[state=open]:shadow-sm data-[state=open]:bg-surface-sage/30"
            >
              <AccordionTrigger className="text-left text-ink font-display font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
                {tQ(`${key}.question`)}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-ink/60 font-body leading-relaxed pb-4">
                {tQ(`${key}.answer`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
