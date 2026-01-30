"use client";

import { useMemo, useState } from "react";
import { useSheet, type SheetResult } from "./sheet-provider";

export type ActionSheetItem = {
  label: string;
  icon?: string;
  tone?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  hint?: string;
  value: string;
};

export function useOverlayPresets() {
  const sheet = useSheet();

  const openActionSheet = async ({
    id,
    title,
    items,
  }: {
    id: string;
    title?: string;
    items: ActionSheetItem[];
  }): Promise<SheetResult> => {
    return sheet.open({
      id,
      title,
      size: "sm",
      render: ({ close }) => (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              disabled={item.disabled}
              onClick={() =>
                close({ type: "data", payload: { value: item.value } })
              }
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)] transition disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                {item.icon ? <span aria-hidden>{item.icon}</span> : null}
                {item.label}
              </span>
              {item.hint ? (
                <span className="text-xs text-[var(--text-muted)]">
                  {item.hint}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ),
    });
  };

  const openSelector = async ({
    id,
    title,
    options,
    selectedId,
    searchable,
    emptyState,
  }: {
    id: string;
    title: string;
    options: {
      id: string;
      label: string;
      subLabel?: string;
      metaRight?: string;
      disabledReason?: string;
      group?: string;
    }[];
    selectedId?: string;
    searchable?: boolean;
    emptyState?: string;
  }): Promise<string | null> => {
    const result = await sheet.open({
      id,
      title,
      size: "md",
      render: ({ close }) => (
        <SelectorContent
          options={options}
          selectedId={selectedId}
          searchable={searchable}
          emptyState={emptyState}
          onSelect={(value) => close({ type: "data", payload: { value } })}
        />
      ),
    });

    if (result.type === "data") {
      return typeof result.payload?.value === "string"
        ? result.payload.value
        : null;
    }
    return null;
  };

  const openConfirm = async ({
    id,
    title,
    body,
    details,
    confirmLabel,
    tone,
  }: {
    id: string;
    title: string;
    body: string;
    details?: string;
    confirmLabel: string;
    tone?: "primary" | "danger";
  }) => {
    const result = await sheet.open({
      id,
      title,
      size: "sm",
      render: () => (
        <div className="flex flex-col gap-3 text-sm text-[var(--text)]">
          <p>{body}</p>
          {details ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-xs text-[var(--text-muted)]">
              {details}
            </div>
          ) : null}
        </div>
      ),
      actions: [
        {
          key: "cancel",
          label: "Cancel",
          tone: "secondary",
          autoClose: true,
        },
        {
          key: "confirm",
          label: confirmLabel,
          tone: tone === "danger" ? "danger" : "primary",
          autoClose: true,
        },
      ],
    });

    return result.type === "action" && result.payload?.key === "confirm";
  };

  return useMemo(
    () => ({ openActionSheet, openSelector, openConfirm }),
    [openActionSheet, openSelector, openConfirm],
  );
}

function SelectorContent({
  options,
  selectedId,
  searchable,
  emptyState,
  onSelect,
}: {
  options: {
    id: string;
    label: string;
    subLabel?: string;
    metaRight?: string;
    disabledReason?: string;
    group?: string;
  }[];
  selectedId?: string;
  searchable?: boolean;
  emptyState?: string;
  onSelect: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = !searchable
    ? options
    : options.filter((opt) =>
        opt.label.toLowerCase().includes(query.toLowerCase()),
      );
  const grouped = filtered.reduce<Record<string, typeof filtered>>(
    (acc, option) => {
      const key = option.group ?? "";
      if (!acc[key]) acc[key] = [];
      acc[key].push(option);
      return acc;
    },
    {},
  );
  const groups = Object.entries(grouped);

  return (
    <div className="flex flex-col gap-4">
      {searchable ? (
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
        />
      ) : null}
      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          {emptyState ?? "No options available."}
        </p>
      ) : null}
      {groups.map(([group, groupOptions]) => (
        <div key={group} className="flex flex-col gap-2">
          {group ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {group}
            </p>
          ) : null}
          {groupOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={Boolean(option.disabledReason)}
              onClick={() => onSelect(option.id)}
              className={`flex w-full items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)] transition disabled:opacity-50 ${
                option.id === selectedId ? "border-[var(--accent)]" : ""
              }`}
            >
              <span>
                {option.label}
                {option.subLabel ? (
                  <span className="mt-1 block text-xs text-[var(--text-muted)]">
                    {option.subLabel}
                  </span>
                ) : null}
                {option.disabledReason ? (
                  <span className="mt-1 block text-xs text-[var(--danger)]">
                    {option.disabledReason}
                  </span>
                ) : null}
              </span>
              {option.metaRight ? (
                <span className="text-xs text-[var(--text-muted)]">
                  {option.metaRight}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
