// Adapted from Invoify (https://github.com/al1abb/invoify), MIT License, Copyright (c) 2023 Ali Abbasov.
// (Fit-to-width A4 preview pane.)
"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFitScale } from "@/hooks/use-fit-scale";
import { cn } from "@/lib/utils";

/**
 * The server-rendered A4 sheet, scaled down to the pane's width ("Fit") or
 * at full size with horizontal scrolling ("100%"). Printing ignores both.
 */
export function DocumentViewer({ children }: { children: ReactNode }) {
  const t = useTranslations("QuoteDetail.viewer");
  const [fit, setFit] = useState(true);
  const { paneRef, contentRef, scale, scaledHeight, scaledWidth, ready } = useFitScale({ enabled: fit });

  return (
    <section
      aria-label={t("label")}
      className="overflow-hidden rounded-xl border bg-ground print:overflow-visible print:rounded-none print:border-0 print:bg-transparent"
    >
      <div className="flex items-center justify-between gap-3 border-b bg-card/60 px-3 py-2 print:hidden">
        <span className="pl-1 text-xs font-medium tabular-nums text-muted-foreground" aria-live="polite">
          {ready ? `${Math.round(scale * 100)}%` : null}
        </span>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={fit ? "fit" : "actual"}
          onValueChange={(value) => value && setFit(value === "fit")}
          aria-label={t("zoom")}
        >
          <ToggleGroupItem value="fit" className="h-11 px-4 text-sm md:h-8 md:px-3 md:text-xs">
            {t("fit")}
          </ToggleGroupItem>
          <ToggleGroupItem value="actual" className="h-11 px-4 text-sm md:h-8 md:px-3 md:text-xs">
            {t("actual")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div
        ref={paneRef}
        className={cn(
          "p-3 sm:p-5 lg:p-8 print:overflow-visible print:p-0",
          fit ? "overflow-hidden" : "overflow-x-auto overscroll-x-contain"
        )}
      >
        <div
          className={cn("mx-auto print:!h-auto print:!w-auto", !ready && "bg-paper shadow-elevated")}
          // Until measured, reserve one A4 page so the layout does not jump.
          style={
            ready
              ? { height: scaledHeight, width: scaledWidth }
              : { aspectRatio: "210 / 297", maxWidth: "210mm" }
          }
        >
          <div
            ref={contentRef}
            className="w-[210mm] origin-top-left shadow-elevated ring-1 ring-black/5 print:w-auto print:transform-none print:shadow-none print:ring-0"
            style={{
              transform: scale === 1 ? undefined : `scale(${scale})`,
              visibility: ready ? undefined : "hidden",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
