'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (selector: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire: () => void;
}

/**
 * Cloudflare Turnstile widget with explicit render. The parent collects the
 * token and sends it as turnstileToken with the register request. Without a
 * site key the widget renders nothing and the form submits without a token.
 */
export function TurnstileWidget({ siteKey, onVerify, onExpire }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const render = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => onVerifyRef.current(token),
      'expired-callback': () => onExpireRef.current(),
      'error-callback': () => onExpireRef.current()
    });
  }, [siteKey]);

  useEffect(() => {
    if (ready) render();
  }, [ready, render]);

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onLoad={() => setReady(true)}
      />
      <div ref={containerRef} />
    </>
  );
}
