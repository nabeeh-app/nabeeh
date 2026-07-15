export const getStatusBadge = (
  status: string,
  locale: "en" | "ar" = "ar",
  t?: (key: string) => string
) => {
  const statusMap: Record<
    string,
    {
      variant: "default" | "destructive" | "secondary" | "outline";
      label: string;
      labelAr: string;
      color: string;
    }
  > = {
    // Common statuses
    active: {
      variant: "default",
      label: "Active",
      labelAr: "نشط",
      color: "bg-surface-sage text-ink",
    },
    inactive: {
      variant: "secondary",
      label: "Inactive",
      labelAr: "غير نشط",
      color: "bg-surface-cool text-ink/70",
    },
    pending: {
      variant: "outline",
      label: "Pending",
      labelAr: "في الانتظار",
      color: "bg-surface-cool text-ink/70",
    },

    // WhatsApp statuses
    connected: {
      variant: "default",
      label: "Connected",
      labelAr: "متصل",
      color: "bg-success/10 text-success",
    },
    disconnected: {
      variant: "destructive",
      label: "Disconnected",
      labelAr: "غير متصل",
      color: "bg-destructive/10 text-destructive",
    },
    connecting: {
      variant: "outline",
      label: "Connecting",
      labelAr: "جاري الاتصال",
      color: "bg-surface-cool text-ink/70",
    },

    // Student statuses
    graduated: {
      variant: "secondary",
      label: "Graduated",
      labelAr: "متخرج",
      color: "bg-primary/10 text-primary",
    },

    // Attendance statuses
    present: {
      variant: "default",
      label: "Present",
      labelAr: "حاضر",
      color: "bg-surface-sage text-ink",
    },
    absent: {
      variant: "destructive",
      label: "Absent",
      labelAr: "غائب",
      color: "bg-destructive/10 text-destructive",
    },
    late: {
      variant: "outline",
      label: "Late",
      labelAr: "متأخر",
      color: "bg-surface-cool text-ink/70",
    },
    excused: {
      variant: "secondary",
      label: "Excused",
      labelAr: "معذور",
      color: "bg-primary/10 text-primary",
    },

    // Course/Class statuses
    ready: {
      variant: "default",
      label: "Ready",
      labelAr: "جاهز",
      color: "bg-success/10 text-success",
    },
    draft: {
      variant: "outline",
      label: "Draft",
      labelAr: "مسودة",
      color: "bg-surface-cool text-ink/70",
    },
    archived: {
      variant: "secondary",
      label: "Archived",
      labelAr: "مؤرشف",
      color: "bg-surface-cool text-ink/70",
    },

    // System statuses
    online: {
      variant: "default",
      label: "Online",
      labelAr: "متصل",
      color: "bg-success/10 text-success",
    },
    offline: {
      variant: "destructive",
      label: "Offline",
      labelAr: "غير متصل",
      color: "bg-destructive/10 text-destructive",
    },
    working: {
      variant: "default",
      label: "Working",
      labelAr: "يعمل",
      color: "bg-success/10 text-success",
    },
    failed: {
      variant: "destructive",
      label: "Failed",
      labelAr: "فشل",
      color: "bg-destructive/10 text-destructive",
    },
    starting: {
      variant: "outline",
      label: "Starting",
      labelAr: "بدء التشغيل",
      color: "bg-surface-cool text-ink/70",
    },
    qr_ready: {
      variant: "secondary",
      label: "Scan QR",
      labelAr: "امسح الرمز",
      color: "bg-primary/10 text-primary",
    },
  };

  const config = statusMap[status.toLowerCase()] || {
    variant: "outline" as const,
    label: status,
    labelAr: status,
    color: "bg-surface-cool text-ink/70",
  };

  const label = t
    ? t(`statuses.${status.toLowerCase()}`) || config.label
    : locale === "ar"
      ? config.labelAr
      : config.label;

  return {
    variant: config.variant,
    label,
    color: config.color,
  };
};
