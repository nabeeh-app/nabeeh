type ConsentState = 'accepted' | 'rejected' | null;

const CONSENT_KEY = 'nabeeh-cookie-consent';

export function getConsent(): ConsentState {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CONSENT_KEY) as ConsentState;
}

export function setConsent(value: ConsentState): void {
  if (typeof window === 'undefined') return;
  if (value === 'accepted' || value === 'rejected') {
    localStorage.setItem(CONSENT_KEY, value);
  } else {
    localStorage.removeItem(CONSENT_KEY);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('consent-change', { detail: value }));
  }
}

export function hasConsent(): boolean {
  return getConsent() === 'accepted';
}
