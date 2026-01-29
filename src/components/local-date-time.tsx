"use client";

import { useEffect, useState } from "react";

type LocalDateTimeProps = {
  value: string | Date | null | undefined;
  fallback?: string;
};

export default function LocalDateTime({ value, fallback = "TBD" }: LocalDateTimeProps) {
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    if (!value) {
      setLabel(fallback);
      return;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      setLabel(fallback);
      return;
    }

    setLabel(
      date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  }, [value, fallback]);

  return <span suppressHydrationWarning>{label}</span>;
}
