"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { addDaysIso, daysUntil, isIsoDate } from "@/lib/dates";
import type { QuoteFormValues } from "@/lib/schemas/quote";
import { cn } from "@/lib/utils";
import { useEditor } from "./editor-context";
import { RequiredMark, PresetChip, fieldClass } from "./field-bits";
import { VALIDITY_PRESET_DAYS } from "./form-model";

export function DetailsSection() {
  const t = useTranslations("QuoteForm");
  const form = useFormContext<QuoteFormValues>();

  return (
    <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>{t("fields.title")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                autoComplete="off"
                placeholder={t("placeholders.title")}
                className={fieldClass}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="salesperson"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {t("fields.salesperson")}
              <RequiredMark />
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                aria-required="true"
                autoComplete="name"
                placeholder={t("placeholders.salesperson")}
                className={fieldClass}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="issuedDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {t("fields.issuedDate")}
              <RequiredMark />
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                type="date"
                aria-required="true"
                className={cn(fieldClass, "tabular-nums")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="validUntil"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {t("fields.validUntil")}
              <RequiredMark />
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                type="date"
                aria-required="true"
                className={cn(fieldClass, "tabular-nums")}
              />
            </FormControl>
            <ExpiryHint />
            <FormMessage />
          </FormItem>
        )}
      />

      <ValidityPresets />
    </div>
  );
}

/** "Expires in 30 days", linked to the valid-until input as its description. */
function ExpiryHint() {
  const t = useTranslations("QuoteForm.validity");
  const { today } = useEditor();
  const validUntil = useWatch<QuoteFormValues, "validUntil">({ name: "validUntil" });
  if (!isIsoDate(validUntil)) return null;
  const days = daysUntil(validUntil, today);
  return (
    <FormDescription
      className={cn(
        "flex items-center gap-1.5",
        days < 0 ? "text-destructive" : days <= 3 ? "text-warning" : undefined
      )}
    >
      <CalendarClock aria-hidden="true" className="size-3.5 shrink-0" />
      {days < 0 ? t("expired", { days: -days }) : t("expiresIn", { days })}
    </FormDescription>
  );
}

function ValidityPresets() {
  const t = useTranslations("QuoteForm.validity");
  const form = useFormContext<QuoteFormValues>();
  const [issuedDate, validUntil] = useWatch({
    control: form.control,
    name: ["issuedDate", "validUntil"],
  });
  const base = isIsoDate(issuedDate) ? issuedDate : null;

  return (
    <div className="-mt-2 md:mt-0 md:self-start md:pt-[1.625rem]">
      <p id="validity-presets-label" className="sr-only">
        {t("presets")}
      </p>
      {/* Four equal cells: one tidy row from a 320px phone to the narrow
          column beside the live preview, where free-flowing chips wrapped. */}
      <div
        role="group"
        aria-labelledby="validity-presets-label"
        className="grid max-w-sm grid-cols-4 gap-1.5"
      >
        {VALIDITY_PRESET_DAYS.map((days) => {
          const target = base ? addDaysIso(base, days) : null;
          return (
            <PresetChip
              key={days}
              pressed={target !== null && target === validUntil}
              disabled={!target}
              title={t("presetLabel", { days })}
              onClick={() => {
                if (!target) return;
                form.setValue("validUntil", target, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              className="w-full justify-center whitespace-nowrap px-1 tabular-nums"
            >
              {t("preset", { days })}
            </PresetChip>
          );
        })}
      </div>
    </div>
  );
}
