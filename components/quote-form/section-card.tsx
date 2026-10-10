"use client";

import { useId, type ReactNode } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { AlertCircle, Check, ChevronDown, type LucideIcon } from "lucide-react";
import type { QuoteFormValues } from "@/lib/schemas/quote";
import { cn } from "@/lib/utils";
import {
  SECTION_WATCH_FIELDS,
  collectErrorPaths,
  sectionDomId,
  sectionStates,
  type SectionId,
  type SectionInputs,
  type SectionState,
} from "./form-model";

/** Live ✓ / ! / • state per section from a narrow watch (not the whole form). */
export function useSectionStates(): Record<SectionId, SectionState> {
  const { control } = useFormContext<QuoteFormValues>();
  const watched = useWatch({ control, name: [...SECTION_WATCH_FIELDS] });
  const { errors } = useFormState({ control });
  const values = Object.fromEntries(
    SECTION_WATCH_FIELDS.map((field, index) => [field, watched[index]])
  ) as SectionInputs;
  return sectionStates(values, collectErrorPaths(errors));
}

export function SectionStateIcon({
  state,
  className,
}: {
  state: SectionState;
  className?: string;
}) {
  const t = useTranslations("QuoteForm.sections.state");
  const base = "flex size-5 shrink-0 items-center justify-center rounded-full";
  return (
    <span className={cn(base, STATE_STYLES[state], className)}>
      {state === "complete" ? (
        <Check aria-hidden="true" className="size-3" strokeWidth={3} />
      ) : state === "error" ? (
        <AlertCircle aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      ) : (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      )}
      <span className="sr-only">{t(state)}</span>
    </span>
  );
}

const STATE_STYLES: Record<SectionState, string> = {
  complete: "bg-success text-success-foreground",
  error: "bg-destructive text-destructive-foreground",
  incomplete: "border border-border bg-background text-muted-foreground",
  optional: "border border-dashed border-border bg-background text-muted-foreground/70",
};

type SectionCardProps = {
  id: SectionId;
  icon: LucideIcon;
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One-line recap shown while collapsed */
  summary?: ReactNode;
  /** Right side of the header (inside the card, outside the toggle) */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * A form section: anchor target for the section index, collapsible (mostly
 * for phones, where five long sections are a lot of scrolling). Collapsed
 * content stays mounted so its fields stay registered and focusable once
 * reopened.
 */
export function SectionCard({
  id,
  icon: Icon,
  title,
  description,
  open,
  onOpenChange,
  summary,
  aside,
  children,
  className,
}: SectionCardProps) {
  const uid = useId();
  const contentId = `${uid}-content`;
  return (
    <section
      id={sectionDomId(id)}
      tabIndex={-1}
      aria-labelledby={`${uid}-title`}
      className={cn(
        "scroll-mt-28 rounded-xl border bg-card text-card-foreground shadow-card outline-none md:scroll-mt-32",
        className
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3 md:px-6 md:py-4">
        <h2 id={`${uid}-title`} className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={() => onOpenChange(!open)}
            className="group flex min-h-11 w-full items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:min-h-10"
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <Icon className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-base font-semibold leading-6 tracking-tight">
                {title}
                <SectionStateBadge id={id} />
              </span>
              {!open && summary ? (
                <span className="block truncate text-sm font-normal text-muted-foreground">
                  {summary}
                </span>
              ) : description ? (
                <span
                  aria-hidden="true"
                  className="hidden truncate text-sm font-normal text-muted-foreground sm:block"
                >
                  {description}
                </span>
              ) : null}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded:rotate-180"
            />
          </button>
        </h2>
        {aside}
      </div>
      <div id={contentId} hidden={!open} className="px-4 pb-5 md:px-6 md:pb-6">
        {children}
      </div>
    </section>
  );
}

/** Only errors are flagged in the header; the index shows the full state. */
function SectionStateBadge({ id }: { id: SectionId }) {
  const states = useSectionStates();
  if (states[id] !== "error") return null;
  return <SectionStateIcon state="error" />;
}
