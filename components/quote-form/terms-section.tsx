// Adapted from Invoify (https://github.com/al1abb/invoify), MIT License, Copyright (c) 2023 Ali Abbasov.
// (PaymentTermPresets: localized one-tap chips over a free-text field.)
"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { QuoteFormValues } from "@/lib/schemas/quote";
import { cn } from "@/lib/utils";
import { PresetChip, fieldClass } from "./field-bits";

const PAYMENT_PRESETS = ["net30", "net60", "cod", "deposit", "transfer"] as const;

export function TermsSection() {
  const t = useTranslations("QuoteForm");
  const form = useFormContext<QuoteFormValues>();

  return (
    <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
      <FormField
        control={form.control}
        name="paymentMethod"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>{t("fields.paymentMethod")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                autoComplete="off"
                placeholder={t("placeholders.paymentMethod")}
                className={fieldClass}
              />
            </FormControl>
            <PaymentPresets />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="shippingMethod"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("fields.shippingMethod")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                autoComplete="off"
                placeholder={t("placeholders.shippingMethod")}
                className={fieldClass}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="shippingDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("fields.shippingDate")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                type="date"
                className={cn(fieldClass, "tabular-nums")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {(["notes", "terms"] as const).map((name) => (
        <FormField
          key={name}
          control={form.control}
          name={name}
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>{t(`fields.${name}`)}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  rows={3}
                  placeholder={t(`placeholders.${name}`)}
                  className="min-h-[5.5rem] resize-y [field-sizing:content]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}

function PaymentPresets() {
  const t = useTranslations("QuoteForm.terms");
  const form = useFormContext<QuoteFormValues>();
  const current = String(useWatch<QuoteFormValues, "paymentMethod">({ name: "paymentMethod" }) ?? "").trim();

  return (
    <div role="group" aria-label={t("presets")} className="flex flex-wrap gap-2 pt-1">
      {PAYMENT_PRESETS.map((key) => {
        const label = t(`paymentPresets.${key}`);
        return (
          <PresetChip
            key={key}
            pressed={current === label}
            onClick={() =>
              form.setValue("paymentMethod", label, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              })
            }
          >
            {label}
          </PresetChip>
        );
      })}
    </div>
  );
}
