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
  /** Gates the grades CRUD page. Fully implemented. */
  grades: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_GRADES, true),
  /** Gates the reports dashboard. Fully implemented. */
  reports: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_REPORTS, true),
  /** Gates the messaging/WhatsApp broadcast page. Not yet implemented. */
  messaging: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_MESSAGING),
  /** Gates the courses/offering management page. Fully implemented. */
  courses: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_COURSES, true),
  /** Gates the system monitor page. Fully implemented. */
  monitor: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_MONITOR, true),
  /** Gates the assistants/teachers management page. Implemented. */
  assistants: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_ASSISTANTS, true),
  /** Gates AI-powered features (Gemini bot, smart responses). */
  aiFeatures: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_AI, true),
  /** Gates the alerts configuration page. Implemented. */
  alerts: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_ALERTS, true),
  /** Gates the notifications page. Not yet implemented. */
  notifications: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS, false),
  /** Gates the grade analysis page. No page exists yet. */
  gradeAnalysis: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_GRADE_ANALYSIS, false),
} as const;

export type FeatureKey = keyof typeof featureFlags;

export const isFeatureEnabled = (key: FeatureKey) => featureFlags[key];
