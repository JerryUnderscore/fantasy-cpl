"use client";

import { useMemo } from "react";

type LocalDateTimeProps = {
  value: string | Date | null | undefined;
  fallback?: string;
};

export default function LocalDateTime({
  value,
  fallback = "TBD",
}: LocalDateTimeProps) {
  const label = useMemo(() => {
    if (!value) return fallback;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [value, fallback]);

  return <span suppressHydrationWarning>{label}</span>;
}
