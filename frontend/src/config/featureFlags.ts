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
  grades: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_GRADES),
  reports: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_REPORTS),
  messaging: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_MESSAGING),
  courses: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_COURSES),
  monitor: parseEnvFlag(process.env.NEXT_PUBLIC_FEATURE_MONITOR),
} as const;

export type FeatureKey = keyof typeof featureFlags;

export const isFeatureEnabled = (key: FeatureKey) => featureFlags[key];
