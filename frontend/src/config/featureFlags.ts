const parseEnvFlag = (value: string | undefined, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

export const featureFlags = {
  /** Gates the messaging/WhatsApp broadcast page. Not yet implemented. */
  messaging: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_MESSAGING),
  /** Gates the notifications page. Not yet implemented. */
  notifications: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS, false),
  /** Gates the grade analysis page. No page exists yet. */
  gradeAnalysis: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_GRADE_ANALYSIS, false),
} as const;

export type FeatureKey = keyof typeof featureFlags;

export const isFeatureEnabled = (key: FeatureKey) => featureFlags[key];
