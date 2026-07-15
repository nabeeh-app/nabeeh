type Locale = "ar" | "en";

function getLocale(locale?: string): Locale {
  return locale === "ar" ? "ar" : "en";
}

function toDate(date: Date | string): Date {
  return typeof date === "string" ? new Date(date) : date;
}

export function timeAgo(
  dateStr: string,
  locale: string = "ar",
  t?: (key: string, params?: Record<string, unknown>) => string
): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (t) {
    if (mins < 1) return t("timeAgo.justNow");
    if (mins < 60) return t("timeAgo.minutes", { n: mins });
    if (hours < 24) return t("timeAgo.hours", { n: hours });
    return t("timeAgo.days", { n: days });
  }

  if (locale === "ar") {
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} د`;
    if (hours < 24) return `منذ ${hours} س`;
    return `منذ ${days} ي`;
  }
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function formatDate(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleDateString(getLocale(locale) === "ar" ? "ar-SA" : "en-US");
}

export function formatDateLong(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleDateString(getLocale(locale) === "ar" ? "ar-SA" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatMonthYear(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleDateString(getLocale(locale) === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "long",
  });
}

export function formatDateTime(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleString(getLocale(locale) === "ar" ? "ar-SA" : "en-US");
}

export function formatTime(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleTimeString(getLocale(locale) === "ar" ? "ar-SA" : "en-US");
}
