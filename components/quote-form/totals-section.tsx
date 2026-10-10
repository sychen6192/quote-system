"use client";

import { useRef, useState, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { useAppConfig } from "@/components/providers/app-config-provider";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { amountInWordsEn, amountInWordsZhTW } from "@/lib/amount-in-words";
import type { QuoteFinancials } from "@/lib/money";
import type { QuoteFormValues } from "@/lib/schemas/quote";
import { cn } from "@/lib/utils";
import { useMoney, useRevealListener } from "./editor-context";
import { AdornedInput, decimalInputProps } from "./field-bits";
import { formTotals, lenientNumber, roundToDisplayed } from "./form-model";

const TOTAL_FIELDS = ["items", "taxRate", "discountType", "discountValue", "otherFees"] as const;

/**
 * Live totals with exactly the server's arithmetic (lib/money). Re-renders
 * only when a total changes, not on every keystroke in a product name.
 */
export function useFormTotals(): QuoteFinancials {
  return useWatch<QuoteFormValues, (typeof TOTAL_FIELDS)[number][], QuoteFormValues, QuoteFinancials>({
    name: [...TOTAL_FIELDS],
    compute: (watched) => {
      const [items, taxRate, discountType, discountValue, otherFees] = watched as [
        QuoteFormValues["items"] | undefined,
        QuoteFormValues["taxRate"],
        QuoteFormValues["discountType"],
        QuoteFormValues["discountValue"],
        QuoteFormValues["otherFees"],
      ];
      return formTotals({ items: items ?? [], taxRate, discountType, discountValue, otherFees });
    },
  });
}

const compactField = "h-11 w-full bg-background md:h-9";

export function TotalsSection() {
  const t = useTranslations("QuoteForm");
  const locale = useLocale();
  const form = useFormContext<QuoteFormValues>();
  const money = useMoney();
  const { showAmountInWords, currency } = useAppConfig();
  const totals = useFormTotals();
  const taxRate = lenientNumber(useWatch<QuoteFormValues, "taxRate">({ name: "taxRate" }));
  const discountType = useWatch<QuoteFormValues, "discountType">({ name: "discountType" });

  const [showDiscount, setShowDiscount] = useState(
    () => lenientNumber(form.getValues("discountValue")) > 0
  );
  const [showFees, setShowFees] = useState(() => lenientNumber(form.getValues("otherFees")) > 0);
  const addDiscountRef = useRef<HTMLButtonElement>(null);
  const addFeesRef = useRef<HTMLButtonElement>(null);

  useRevealListener((path) => {
    if (path === "discountValue") setShowDiscount(true);
    if (path === "otherFees") setShowFees(true);
  });

  const reveal = (which: "discountValue" | "otherFees") => {
    if (which === "discountValue") setShowDiscount(true);
    else setShowFees(true);
    requestAnimationFrame(() => form.setFocus(which, { shouldSelect: true }));
  };

  const hide = (which: "discountValue" | "otherFees") => {
    form.setValue(which, 0, { shouldDirty: true, shouldValidate: true });
    if (which === "discountValue") setShowDiscount(false);
    else setShowFees(false);
    requestAnimationFrame(() =>
      (which === "discountValue" ? addDiscountRef : addFeesRef).current?.focus()
    );
  };

  // Words must match the figure shown: NT$450,162.50 displays as NT$450,163.
  const shown = roundToDisplayed(totals.total, money.digits);
  const words = showAmountInWords
    ? locale === "zh-TW"
      ? amountInWordsZhTW(shown, { prefix: currency === "TWD" ? "新台幣" : "" })
      : amountInWordsEn(shown)
    : null;
  const partlyExempt = totals.taxableSubtotal !== totals.subtotal;

  const removeButton = (which: "discountValue" | "otherFees", label: string) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => hide(which)}
      aria-label={label}
      className="size-11 shrink-0 text-muted-foreground md:size-9"
    >
      <X aria-hidden="true" />
    </Button>
  );
  const rowLabel = "text-sm font-normal text-muted-foreground";

  return (
    <div className="md:ml-auto md:max-w-lg md:rounded-lg md:border md:bg-muted/30 md:p-5 md:dark:bg-background/40">
      <div className="space-y-4">
        <Row label={<div className="text-sm text-muted-foreground">{t("totals.subtotal")}</div>}>
          <div className="money text-sm font-medium">{money.format(totals.subtotal)}</div>
        </Row>

        {showDiscount && (
          <FormField
            control={form.control}
            name="discountValue"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <AdjustRow
                  label={<FormLabel className={rowLabel}>{t("fields.discount")}</FormLabel>}
                  amount={
                    <span className="money text-sm font-medium text-success">
                      {totals.discount > 0 ? `−${money.format(totals.discount)}` : money.format(0)}
                    </span>
                  }
                >
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={discountType === "percent" ? "percent" : "amount"}
                    onValueChange={(value) => {
                      if (value !== "amount" && value !== "percent") return;
                      form.setValue("discountType", value, { shouldDirty: true });
                      if (form.getFieldState("discountValue").isTouched) {
                        void form.trigger("discountValue");
                      }
                    }}
                    aria-label={t("totals.discountType")}
                    className="shrink-0 gap-0 rounded-md"
                  >
                    <ToggleGroupItem
                      value="amount"
                      aria-label={t("totals.discountAmount")}
                      className="h-11 min-w-11 rounded-r-none bg-background px-3 md:h-9 md:min-w-9"
                    >
                      <span aria-hidden="true">{money.symbol}</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="percent"
                      aria-label={t("totals.discountPercent")}
                      className="-ml-px h-11 min-w-11 rounded-l-none bg-background px-3 md:h-9 md:min-w-9"
                    >
                      <span aria-hidden="true">%</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <AdornedInput
                    prefix={discountType === "percent" ? undefined : money.symbol}
                    suffix={discountType === "percent" ? "%" : undefined}
                    className="w-full max-w-36"
                  >
                    {(adorned) => (
                      <FormControl>
                        <Input
                          {...decimalInputProps(field)}
                          placeholder="0"
                          className={cn(compactField, adorned, "text-right")}
                        />
                      </FormControl>
                    )}
                  </AdornedInput>
                  {removeButton("discountValue", t("totals.removeDiscount"))}
                </AdjustRow>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="taxRate"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <AdjustRow
                label={<FormLabel className={rowLabel}>{t("fields.taxRate")}</FormLabel>}
                amount={
                  <span className="block">
                    <span className="block text-xs text-muted-foreground">
                      {t("totals.tax", { rate: taxRate })}
                    </span>
                    <span className="money text-sm font-medium">{money.format(totals.tax)}</span>
                  </span>
                }
              >
                <AdornedInput suffix="%" className="w-24">
                  {(adorned) => (
                    <FormControl>
                      <Input
                        {...decimalInputProps(field)}
                        aria-required="true"
                        className={cn(compactField, adorned, "text-right")}
                      />
                    </FormControl>
                  )}
                </AdornedInput>
              </AdjustRow>
              {partlyExempt && (
                <FormDescription>
                  {t("totals.taxBase", { amount: money.format(totals.taxBase) })}
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {showFees && (
          <FormField
            control={form.control}
            name="otherFees"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <AdjustRow
                  label={<FormLabel className={rowLabel}>{t("fields.otherFees")}</FormLabel>}
                  amount={
                    <span className="money text-sm font-medium">{money.format(totals.otherFees)}</span>
                  }
                >
                  <AdornedInput prefix={money.symbol} className="w-full max-w-36">
                    {(adorned) => (
                      <FormControl>
                        <Input
                          {...decimalInputProps(field)}
                          placeholder="0"
                          className={cn(compactField, adorned, "text-right")}
                        />
                      </FormControl>
                    )}
                  </AdornedInput>
                  {removeButton("otherFees", t("totals.removeFees"))}
                </AdjustRow>
                <FormDescription>{t("hints.otherFees")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {(!showDiscount || !showFees) && (
          <div className="-ml-2 flex flex-wrap gap-1">
            {!showDiscount && (
              <Button
                ref={addDiscountRef}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => reveal("discountValue")}
                className="h-11 px-2 text-primary hover:text-primary md:h-8"
              >
                <Plus aria-hidden="true" />
                {t("totals.addDiscount")}
              </Button>
            )}
            {!showFees && (
              <Button
                ref={addFeesRef}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => reveal("otherFees")}
                className="h-11 px-2 text-primary hover:text-primary md:h-8"
              >
                <Plus aria-hidden="true" />
                {t("totals.addFees")}
              </Button>
            )}
          </div>
        )}

        <div className="border-t pt-4">
          <Row label={<div className="text-base font-semibold">{t("totals.total")}</div>}>
            <div className="money text-2xl font-bold tracking-tight text-primary md:text-3xl">
              {money.format(totals.total)}
            </div>
          </Row>
          {words && (
            <p className="mt-1.5 text-right text-sm text-muted-foreground">
              <span className="sr-only">{t("totals.amountInWords")}: </span>
              {words}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Label · controls · amount on one line from sm up; on phones the label and
 * amount share the first line and the controls get a full-width second line.
 */
function AdjustRow({
  label,
  amount,
  children,
}: {
  label: ReactNode;
  amount: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
      <div className="min-w-0">{label}</div>
      <div className="text-right sm:order-last">{amount}</div>
      <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2">
      {label}
      {children}
    </div>
  );
}
