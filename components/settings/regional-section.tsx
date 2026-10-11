"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFormContext, useWatch } from "react-hook-form";
import { z } from "zod";
import { Coins, Globe2, TriangleAlert } from "lucide-react";
import { currencyFractionDigits, formatMoney } from "@/lib/money";
import { settingsSectionSchemas } from "@/lib/settings/schema";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { buildSectionPatch } from "./model";
import {
  COMMON_CURRENCIES,
  COMMON_MONEY_LOCALES,
  currencyName,
  localeName,
} from "./regional";
import { useSettingsPage } from "./settings-context";
import {
  fieldClass,
  FieldSource,
  SaveBar,
  saveSections,
  SectionFormProvider,
  SectionHeading,
  SettingsCard,
  settingsFieldFor,
  useSettingsForm,
} from "./settings-form";
import { TimeZoneCombobox } from "./timezone-combobox";

type RegionalForm = {
  currency: string;
  currencyLocale: string;
  timezone: string;
  twVatLookup: boolean;
};

// One form over three stored sections.
const Field = settingsFieldFor<RegionalForm>();

const schema = z.object({
  currency: settingsSectionSchemas.money.shape.currency,
  currencyLocale: settingsSectionSchemas.money.shape.currencyLocale,
  timezone: settingsSectionSchemas.region.shape.timezone,
  twVatLookup: settingsSectionSchemas.features.shape.twVatLookup,
});

const OTHER = "__other";

const pick = (keys: string[], allowed: readonly string[]) => keys.filter((key) => allowed.includes(key));

export function RegionalSection() {
  const t = useTranslations("Settings.regional");
  const headingId = useId();
  const { data } = useSettingsPage();
  const initial = useMemo<RegionalForm>(
    () => ({
      currency: String(data.values.money.currency),
      currencyLocale: String(data.values.money.currencyLocale),
      timezone: String(data.values.region.timezone),
      twVatLookup: Boolean(data.values.features.twVatLookup),
    }),
    [data.values.money, data.values.region, data.values.features]
  );

  const { form, formRef, submit, saving, isDirty, discard, api } = useSettingsForm<RegionalForm, RegionalForm>({
    tab: "regional",
    schema,
    initial,
    toForm: (output) => output,
    save: (output, changed) =>
      saveSections([
        ["money", buildSectionPatch("money", pick(changed, ["currency", "currencyLocale"]), output)],
        ["region", buildSectionPatch("region", pick(changed, ["timezone"]), output)],
        ["features", buildSectionPatch("features", pick(changed, ["twVatLookup"]), output)],
      ]),
  });

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <SectionHeading id={headingId} icon={Globe2} title={t("title")} />
      <SectionFormProvider api={api}>
        <Form {...form}>
          <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
            <SettingsCard title={t("moneyTitle")}>
              <MoneyFields initialCurrency={initial.currency} />
            </SettingsCard>

            <SettingsCard title={t("timeTitle")}>
              <Field
                section="region"
                name="timezone"
                label={t("timezone")}
                className="max-w-md"
              >
                {(field) => (
                  <TimeZoneCombobox
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              </Field>
            </SettingsCard>

            <SettingsCard title={t("taiwanTitle")}>
              <FormField
                control={form.control}
                name="twVatLookup"
                render={({ field }) => (
                  <FormItem className="flex items-start justify-between gap-4 space-y-0 rounded-lg border bg-background/50 p-3 md:p-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <FormLabel>{t("vatLookup")}</FormLabel>
                        <FieldSource section="features" name="twVatLookup" current={field.value} label={t("vatLookup")} />
                      </div>
                      <FormDescription>{t("vatLookupHint")}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        name={field.name}
                        className="mt-0.5"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </SettingsCard>

            <SaveBar dirty={isDirty} saving={saving} onDiscard={discard} />
          </form>
        </Form>
      </SectionFormProvider>
    </section>
  );
}

/**
 * A Select of common values plus "Other…", which reveals a free-text input
 * for anything else Intl supports.
 */
function SelectOrOther({
  name,
  section,
  label,
  options,
  describe,
  otherLabel,
  otherPlaceholder,
  inputClassName,
  normalize,
}: {
  name: "currency" | "currencyLocale";
  section: "money";
  label: string;
  options: readonly string[];
  describe: (value: string) => string;
  otherLabel: string;
  otherPlaceholder: string;
  inputClassName?: string;
  normalize?: (value: string) => string;
}) {
  const { control } = useFormContext<RegionalForm>();
  const otherRef = useRef<HTMLInputElement | null>(null);
  // Whether the list's close moves focus to the "Other…" field instead of the
  // trigger, where typing would type-ahead-select a listed value. Each open
  // arms it in Other mode (picking "Other…" again fires no onValueChange);
  // picking "Other…" arms it; a listed pick, Escape or a click outside
  // disarms it.
  const focusOtherOnClose = useRef(false);
  // Selected, so typing replaces the value carried over from the list
  // (a currency is capped at 3 letters, so typing after it did nothing).
  const focusOther = () => {
    otherRef.current?.focus();
    otherRef.current?.select();
  };
  const otherId = useId();
  const value = useWatch({ control, name }) ?? "";
  const [otherMode, setOtherMode] = useState(() => !options.includes(value));
  const [typing, setTyping] = useState(false);
  const [previous, setPrevious] = useState(value);
  // A value set from outside (Discard, Reset, a refresh) that is in the list
  // shows in the Select again.
  if (previous !== value) {
    setPrevious(value);
    if (!typing && options.includes(value)) setOtherMode(false);
  }
  const isOther = otherMode || !options.includes(value);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="min-w-0">
          <div className="flex min-h-6 items-center justify-between gap-2">
            <FormLabel>{label}</FormLabel>
            <FieldSource section={section} name={name} current={field.value} label={label} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={isOther ? OTHER : field.value}
              onOpenChange={(open) => {
                if (open) focusOtherOnClose.current = isOther;
              }}
              onValueChange={(next) => {
                if (next === OTHER) {
                  setOtherMode(true);
                  focusOtherOnClose.current = true;
                  // Right away too, so keys typed during the close animation land.
                  requestAnimationFrame(focusOther);
                  return;
                }
                focusOtherOnClose.current = false;
                setOtherMode(false);
                field.onChange(next);
              }}
            >
              <FormControl>
                <SelectTrigger className={cn(fieldClass, "sm:flex-1")}>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent
                className="max-h-80"
                onEscapeKeyDown={() => {
                  focusOtherOnClose.current = false;
                }}
                onPointerDownOutside={() => {
                  focusOtherOnClose.current = false;
                }}
                onCloseAutoFocus={(event) => {
                  if (!focusOtherOnClose.current) return;
                  focusOtherOnClose.current = false;
                  event.preventDefault();
                  // Already there from the rAF in onValueChange, maybe typed into: leave it.
                  if (document.activeElement !== otherRef.current) focusOther();
                }}
              >
                {options.map((option) => (
                  <SelectItem key={option} value={option} className="py-2">
                    <span className="font-medium tabular-nums">{option}</span>
                    <span className="ml-2 text-muted-foreground">{describe(option)}</span>
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value={OTHER} className="py-2">
                  {otherLabel}
                </SelectItem>
              </SelectContent>
            </Select>
            {isOther ? (
              <Input
                ref={otherRef}
                id={otherId}
                aria-label={`${label} — ${otherLabel}`}
                value={field.value}
                onChange={(event) =>
                  field.onChange(normalize ? normalize(event.target.value) : event.target.value)
                }
                onFocus={() => setTyping(true)}
                onBlur={() => {
                  setTyping(false);
                  field.onBlur();
                }}
                placeholder={otherPlaceholder}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={fieldState.invalid || undefined}
                className={cn(fieldClass, "sm:w-36", inputClassName)}
              />
            ) : null}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function MoneyFields({ initialCurrency }: { initialCurrency: string }) {
  const t = useTranslations("Settings.regional");
  const uiLocale = useLocale();
  const { control } = useFormContext<RegionalForm>();
  const currency = useWatch({ control, name: "currency" }) ?? "";
  const currencyLocale = useWatch({ control, name: "currencyLocale" }) ?? "";
  const currencyChanged = currency.trim().toUpperCase() !== initialCurrency;

  let sample: string | null = null;
  if (/^[A-Z]{3}$/.test(currency.trim().toUpperCase()) && currencyLocale.trim()) {
    const code = currency.trim().toUpperCase();
    try {
      sample = formatMoney(123456789, {
        currency: code,
        currencyLocale: currencyLocale.trim(),
        fractionDigits: currencyFractionDigits(code),
      });
    } catch {
      sample = null;
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
        <SelectOrOther
          name="currency"
          section="money"
          label={t("currency")}
          options={COMMON_CURRENCIES}
          describe={(code) => currencyName(code, uiLocale)}
          otherLabel={t("other")}
          otherPlaceholder={t("currencyOtherPlaceholder")}
          inputClassName="font-mono uppercase"
          normalize={(value) => value.toUpperCase().slice(0, 3)}
        />
        <SelectOrOther
          name="currencyLocale"
          section="money"
          label={t("currencyLocale")}
          options={COMMON_MONEY_LOCALES}
          describe={(tag) => localeName(tag, uiLocale)}
          otherLabel={t("other")}
          otherPlaceholder={t("localeOtherPlaceholder")}
          inputClassName="font-mono"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-background/50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coins aria-hidden="true" className="size-4" />
          {t("sample")}
        </span>
        <span aria-live="polite" className="money text-lg font-semibold tracking-tight">
          {sample ?? "—"}
        </span>
      </div>

      <div
        className={cn(
          "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
          currencyChanged
            ? "border-warning/40 bg-warning/10 text-warning"
            : "border-border bg-muted/50 text-muted-foreground"
        )}
        role={currencyChanged ? "alert" : undefined}
      >
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>{t("currencyWarning")}</p>
      </div>
    </div>
  );
}
