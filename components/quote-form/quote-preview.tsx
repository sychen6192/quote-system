// Adapted from Invoify (https://github.com/al1abb/invoify), MIT License, Copyright (c) 2023 Ali Abbasov.
// (LivePreview: debounced form values → the real document, fit-to-width,
// click-to-edit through data-edit-field targets.)
"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useWatch } from "react-hook-form";
import { useLocale } from "next-intl";
import { QuoteDocument } from "@/components/quote-document/quote-document";
import { useQuoteDocumentLabels } from "@/components/quote-document/use-quote-document-labels";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFitScale } from "@/hooks/use-fit-scale";
import { minorUnitStep } from "@/lib/money";
import { quoteViewFromForm } from "@/lib/quote-view";
import type { QuoteFormValues } from "@/lib/schemas/quote";
import type { DocumentBranding } from "@/lib/settings/types";
import type { QuoteStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

export type QuotePreviewProps = {
  today: string;
  quoteId: number | null;
  quotationNumber: string | null;
  status: QuoteStatus;
  branding: DocumentBranding;
  /** false = 100% (the pane scrolls) */
  fit: boolean;
  onEditField: (field: string) => void;
  className?: string;
};

/**
 * Mounted only where it is visible (the desktop pane, or the open sheet), and
 * loaded with next/dynamic. The watch re-renders this wrapper per keystroke,
 * but the document only re-renders when the 300 ms debounced values change.
 */
export default function QuotePreview({
  today,
  quoteId,
  quotationNumber,
  status,
  branding,
  fit,
  onEditField,
  className,
}: QuotePreviewProps) {
  const values = useWatch<QuoteFormValues>();
  const debounced = useDebouncedValue(values, 300);
  const labels = useShallowStable(useQuoteDocumentLabels());
  const locale = useLocale();

  const view = useMemo(
    () =>
      quoteViewFromForm(debounced as Partial<QuoteFormValues>, {
        today,
        id: quoteId,
        quotationNumber,
        status,
        minorUnitStep: minorUnitStep(branding.fractionDigits),
      }),
    [debounced, today, quoteId, quotationNumber, status, branding.fractionDigits]
  );
  const paper = useMemo(
    () => (
      <QuoteDocument
        view={view}
        branding={branding}
        labels={labels}
        locale={locale}
        interactive
        onEditField={onEditField}
      />
    ),
    [view, branding, labels, locale, onEditField]
  );

  return (
    <FitToWidth fit={fit} className={className}>
      {paper}
    </FitToWidth>
  );
}

function shallowEqual(a: object, b: object): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  return (
    ak.length === bk.length &&
    ak.every((key) => Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  );
}

/** Keeps the previous object while its contents are unchanged, so memos downstream hold. */
function useShallowStable<T extends object>(value: T): T {
  const [stable, setStable] = useState(value);
  const same = stable === value || shallowEqual(stable, value);
  if (!same) setStable(value);
  return same ? stable : value;
}

function FitToWidth({
  fit,
  className,
  children,
}: {
  fit: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { paneRef, contentRef, scale, scaledHeight, scaledWidth, ready } = useFitScale({
    enabled: fit,
  });
  return (
    <div
      ref={paneRef}
      className={cn(
        "min-h-0 flex-1 overflow-auto overscroll-contain p-4 [scrollbar-gutter:stable] md:p-6",
        className
      )}
    >
      <div
        className="mx-auto print:h-auto print:w-auto"
        style={{ height: scaledHeight, width: scaledWidth }}
      >
        <div
          ref={contentRef}
          className="min-h-[297mm] w-[210mm] origin-top-left bg-paper text-paper-foreground shadow-elevated ring-1 ring-black/5 print:transform-none"
          style={{
            transform: scale === 1 ? undefined : `scale(${scale})`,
            visibility: ready ? undefined : "hidden",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
