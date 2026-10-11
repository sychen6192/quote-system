"use client";

import { useId, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFormContext, useWatch } from "react-hook-form";
import { AlertCircle, ReceiptText, Sparkles } from "lucide-react";
import { currencyFractionDigits } from "@/lib/money";
import { amountInWords } from "@/components/quote-document/format";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buildSectionPatch } from "./model";
import {
  insertToken,
  PATTERN_TOKENS,
  previewPattern,
  tokenExample,
  TOKEN_KEYS,
} from "./number-pattern";
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

type QuotesForm = {
  numberPattern: string;
  validityDays: string;
  defaultTaxRate: string;
  defaultSalesperson: string;
  defaultNotes: string;
  defaultTerms: string;
  showAmountInWords: boolean;
  footerText: string;
};

type QuotesOutput = {
  numberPattern: string;
  validityDays: number;
  defaultTaxRate: number;
  defaultSalesperson: string;
  defaultNotes: string;
  defaultTerms: string;
  showAmountInWords: boolean;
  footerText: string;
};

const Field = settingsFieldFor<QuotesForm>();

const schema = settingsSectionSchemas.quote;

function toForm(output: QuotesOutput): QuotesForm {
  return {
    ...output,
    validityDays: String(output.validityDays),
    defaultTaxRate: String(output.defaultTaxRate),
  };
}

export function QuotesSection() {
  const t = useTranslations("Settings.quotes");
  const headingId = useId();
  const { data } = useSettingsPage();
  const q = data.values.quote;

  const initial = useMemo<QuotesForm>(
    () => ({
      numberPattern: String(q.numberPattern),
      validityDays: String(q.validityDays),
      defaultTaxRate: String(q.defaultTaxRate),
      defaultSalesperson: String(q.defaultSalesperson),
      defaultNotes: String(q.defaultNotes),
      defaultTerms: String(q.defaultTerms),
      showAmountInWords: Boolean(q.showAmountInWords),
      footerText: String(q.footerText),
    }),
    [q]
  );

  const { form, formRef, submit, saving, isDirty, discard, api } = useSettingsForm<QuotesForm, QuotesOutput>({
    tab: "quotes",
    schema,
    initial,
    toForm,
    save: (output, changed) =>
      saveSections([["quote", buildSectionPatch("quote", changed, output)]]),
  });

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <SectionHeading id={headingId} icon={ReceiptText} title={t("title")} />
      <SectionFormProvider api={api}>
        <Form {...form}>
          <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
            <SettingsCard title={t("numberingTitle")}>
              <NumberPatternField today={data.today} />
            </SettingsCard>

            <SettingsCard title={t("defaultsTitle")}>
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field section="quote" name="validityDays" label={t("validityDays")} suffix={t("daysSuffix")}>
                  {(field) => (
                    <Input
                      {...field}
                      inputMode="numeric"
                      autoComplete="off"
                      className={cn(fieldClass, "pr-12 tabular-nums")}
                    />
                  )}
                </Field>
                <Field section="quote" name="defaultTaxRate" label={t("defaultTaxRate")} suffix="%">
                  {(field) => (
                    <Input
                      {...field}
                      inputMode="decimal"
                      autoComplete="off"
                      className={cn(fieldClass, "pr-8 tabular-nums")}
                    />
                  )}
                </Field>
                <Field
                  section="quote"
                  name="defaultSalesperson"
                  label={t("defaultSalesperson")}
                  className="sm:col-span-2 lg:col-span-1"
                >
                  {(field) => (
                    <Input
                      {...field}
                      autoComplete="name"
                      placeholder={t("defaultSalespersonPlaceholder")}
                      className={fieldClass}
                    />
                  )}
                </Field>
                <Field
                  section="quote"
                  name="defaultNotes"
                  label={t("defaultNotes")}
                  className="sm:col-span-2 lg:col-span-3"
                >
                  {(field) => (
                    <Textarea {...field} rows={3} placeholder={t("defaultNotesPlaceholder")} className="max-h-80 min-h-[5rem] resize-y [field-sizing:content]" />
                  )}
                </Field>
                <Field
                  section="quote"
                  name="defaultTerms"
                  label={t("defaultTerms")}
                  className="sm:col-span-2 lg:col-span-3"
                >
                  {(field) => (
                    <Textarea {...field} rows={4} placeholder={t("defaultTermsPlaceholder")} className="max-h-80 min-h-[6.5rem] resize-y [field-sizing:content]" />
                  )}
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard title={t("documentTitle")}>
              <div className="space-y-5">
                <AmountInWordsField
                  currency={String(data.values.money.currency)}
                  currencyLocale={String(data.values.money.currencyLocale)}
                />
                <Field
                  section="quote"
                  name="footerText"
                  label={t("footerText")}
                >
                  {(field) => (
                    <Textarea {...field} rows={2} placeholder={t("footerTextPlaceholder")} className="max-h-40 min-h-[3.75rem] resize-y [field-sizing:content]" />
                  )}
                </Field>
              </div>
            </SettingsCard>

            <SaveBar dirty={isDirty} saving={saving} onDiscard={discard} />
          </form>
        </Form>
      </SectionFormProvider>
    </section>
  );
}

function NumberPatternField({ today }: { today: string }) {
  const t = useTranslations("Settings.quotes");
  const tValidation = useTranslations("Validation");
  const { control } = useFormContext<QuotesForm>();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const exampleId = useId();
  const tokensLabelId = useId();
  const pattern = useWatch({ control, name: "numberPattern" }) ?? "";
  const preview = previewPattern(pattern, today);

  return (
    <FormField
      control={control}
      name="numberPattern"
      render={({ field }) => {
        const insert = (token: (typeof PATTERN_TOKENS)[number]) => {
          const input = inputRef.current;
          const next = insertToken(
            field.value ?? "",
            token,
            input?.selectionStart ?? null,
            input?.selectionEnd ?? null
          );
          field.onChange(next.value);
          requestAnimationFrame(() => {
            input?.focus();
            input?.setSelectionRange(next.caret, next.caret);
          });
        };
        return (
          <FormItem className="space-y-3">
            <div className="flex min-h-6 items-center justify-between gap-2">
              <FormLabel>{t("numberPattern")}</FormLabel>
              <FieldSource section="quote" name="numberPattern" current={field.value} label={t("numberPattern")} />
            </div>
            <FormControl aria-describedby={exampleId}>
              <Input
                {...field}
                ref={(element) => {
                  field.ref(element);
                  inputRef.current = element;
                }}
                spellCheck={false}
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={64}
                className={cn(fieldClass, "font-mono tracking-wide")}
              />
            </FormControl>

            <div className="space-y-2">
              <p id={tokensLabelId} className="text-xs font-medium text-muted-foreground">
                {t("insertToken")}
              </p>
              <div role="group" aria-labelledby={tokensLabelId} className="flex flex-wrap gap-2">
                {PATTERN_TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insert(token)}
                    title={t(`tokens.${TOKEN_KEYS[token]}`)}
                    aria-label={`${token} — ${t(`tokens.${TOKEN_KEYS[token]}`)}`}
                    className="inline-flex h-11 min-w-0 flex-col items-start justify-center rounded-lg border bg-background px-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
                  >
                    <span className="font-mono text-xs font-semibold leading-4 text-foreground">{token}</span>
                    <span className="text-[11px] leading-4 text-muted-foreground tabular-nums">
                      {tokenExample(token, today)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div
              id={exampleId}
              aria-live="polite"
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2.5",
                preview.ok ? "border-primary/20 bg-accent/60" : "border-destructive/30 bg-destructive/10"
              )}
            >
              {preview.ok ? (
                <>
                  <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="min-w-0 text-sm">
                    <span className="text-muted-foreground">{t("example")}</span>{" "}
                    <span className="break-all font-mono font-semibold text-foreground">{preview.example}</span>
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{t(`patternErrors.${preview.error}`)}</p>
                </>
              )}
            </div>
            {/* While the live box above shows a pattern error, it says it better. */}
            <FormMessage>
              {(message) =>
                !preview.ok ? null : tValidation.has(message) ? tValidation(message) : message
              }
            </FormMessage>
          </FormItem>
        );
      }}
    />
  );
}

function AmountInWordsField({
  currency,
  currencyLocale,
}: {
  currency: string;
  currencyLocale: string;
}) {
  const t = useTranslations("Settings.quotes");
  const locale = useLocale();
  const { control } = useFormContext<QuotesForm>();
  // Exactly what a quote in the current language prints for 12,345.
  const example = amountInWords(
    1234500,
    { currency, currencyLocale, fractionDigits: currencyFractionDigits(currency) },
    locale
  );
  return (
    <FormField
      control={control}
      name="showAmountInWords"
      render={({ field }) => (
        <FormItem className="flex items-start justify-between gap-4 space-y-0 rounded-lg border bg-background/50 p-3 md:p-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <FormLabel className="text-sm">{t("showAmountInWords")}</FormLabel>
              <FieldSource section="quote" name="showAmountInWords" current={field.value} label={t("showAmountInWords")} />
            </div>
            <FormDescription>
              {t.rich("showAmountInWordsHint", {
                example,
                b: (chunks) => <span className="break-keep font-medium text-foreground">{chunks}</span>,
              })}
            </FormDescription>
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
  );
}
