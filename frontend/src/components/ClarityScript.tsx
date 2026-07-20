'use client';

import { useEffect, useState } from 'react';
import { hasConsent } from '@/lib/consent';

const CLARITY_ID = 'x86kzi0f6e';

export default function ClarityScript() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function loadClarity() {
      if (loaded) return;
      if (typeof window === 'undefined') return;
      if ((window as unknown as { clarity?: unknown }).clarity) return;

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
      document.head.appendChild(script);
      setLoaded(true);
    }

    if (hasConsent()) {
      loadClarity();
    }

    function handleConsentChange(e: CustomEvent) {
      if (e.detail === 'accepted') {
        loadClarity();
      }
    }

    window.addEventListener('consent-change', handleConsentChange as EventListener);
    return () => window.removeEventListener('consent-change', handleConsentChange as EventListener);
  }, [loaded]);

  return null;
}
