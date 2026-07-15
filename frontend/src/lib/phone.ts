// Country code mapping — mirrors backend/lib/phone.js
const COUNTRY_CODES: Record<string, string> = {
  EG: '20', SA: '966', AE: '971', KW: '965', QA: '974',
  BH: '973', OM: '968', JO: '962', LB: '961', MA: '212',
  TN: '216', DZ: '213',
};

const MENA_PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

export function normalizePhoneNumber(phone: string): string {
  // Strip everything except digits and +
  let cleaned = phone.replace(/[^\d+]/g, '');
  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
  // If doesn't start with +, try to add country code
  if (!cleaned.startsWith('+')) {
    // Try each country code
    for (const [, code] of Object.entries(COUNTRY_CODES)) {
      if (cleaned.startsWith(code)) {
        cleaned = '+' + cleaned;
        break;
      }
    }
    // Default to Egypt (20) if starts with 0
    if (cleaned.startsWith('0')) {
      cleaned = '+20' + cleaned.slice(1);
    }
  }
  return cleaned;
}

export function validatePhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return MENA_PHONE_REGEX.test(normalized);
}

export function formatPhoneNumber(phone: string, locale?: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (locale === 'ar') {
    return normalized;
  }
  return normalized;
}
