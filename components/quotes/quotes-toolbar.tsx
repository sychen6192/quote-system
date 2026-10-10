"use client";

import { ArrowUpDown, Building2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListSearchInput, useListQuery } from "@/components/app-shell/list-query";
import { DISPLAY_STATUS_VALUES, type DisplayStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

// Mirrors QUOTE_LIST_SORTS in services/quotes.ts (server-only module).
export const SORT_OPTIONS = ["newest", "oldest", "amount_desc", "amount_asc", "valid_until"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

type Counts = Record<DisplayStatus | "all", number>;

/** Search, status chips (with counts) and sort for the quotes list. */
export function QuotesToolbar({
  q,
  customer = "",
  status,
  sort,
  counts,
}: {
  q: string;
  /** Exact customer filter (?customer=, from the customer directory); "" = none. */
  customer?: string;
  status: DisplayStatus | null;
  sort: SortOption;
  counts: Counts;
}) {
  const t = useTranslations("QuotesList");
  const tStatus = useTranslations("Status");
  const { update } = useListQuery();

  const chips: { value: DisplayStatus | "all"; label: string }[] = [
    { value: "all", label: t("all") },
    ...DISPLAY_STATUS_VALUES.map((value) => ({ value, label: tStatus(value) })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <ListSearchInput
          initialValue={q}
          label={t("search.label")}
          placeholder={t("search.placeholder")}
          className="min-w-0 flex-1"
        />
        <Select
          value={sort}
          onValueChange={(value) => update({ sort: value === "newest" ? null : value })}
        >
          <SelectTrigger
            aria-label={t("sort.label")}
            className="relative h-11 w-11 shrink-0 justify-center rounded-lg bg-card px-0 shadow-card sm:w-48 sm:justify-between sm:px-3 md:h-10 [&>svg:last-child]:hidden sm:[&>svg:last-child]:block"
          >
            <ArrowUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            {/* Phones show the icon only: mark a non-default order. */}
            {sort !== "newest" ? (
              <span aria-hidden="true" className="absolute right-2 top-2 size-2 rounded-full bg-primary sm:hidden" />
            ) : null}
            <span className="sr-only sm:not-sr-only sm:flex-1 sm:truncate sm:text-left">
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent align="end">
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option} className="min-h-10 md:min-h-8">
                {t(`sort.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {customer ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 pl-3 pr-1 text-sm font-medium text-foreground">
            <Building2 aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <span className="truncate">{t("customerFilter.label", { name: customer })}</span>
            <button
              type="button"
              onClick={() => update({ customer: null })}
              aria-label={t("customerFilter.clear", { name: customer })}
              title={t("customerFilter.clear", { name: customer })}
              className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-2 hover:bg-primary/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </span>
        </div>
      ) : null}

      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar md:mx-0 md:px-0">
        <ToggleGroup
          type="single"
          value={status ?? "all"}
          onValueChange={(value) => update({ status: !value || value === "all" ? null : value })}
          aria-label={t("statusFilter")}
          className="w-max justify-start gap-2"
        >
          {chips.map((chip) => {
            const selected = (status ?? "all") === chip.value;
            return (
              <ToggleGroupItem
                key={chip.value}
                value={chip.value}
                aria-label={t("statusChip", { label: chip.label, count: counts[chip.value] })}
                className={cn(
                  "h-10 gap-2 rounded-full border bg-card px-3.5 text-sm font-medium text-muted-foreground shadow-card hover:bg-muted hover:text-foreground md:h-9",
                  "data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
                )}
              >
                {chip.label}
                <span
                  className={cn(
                    "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums leading-none",
                    // Solid, not a /20 tint: the tint over the chip was 4.4:1 (4.0:1 dark).
                    selected ? "bg-primary-foreground text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {counts[chip.value]}
                </span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>
    </div>
  );
}
