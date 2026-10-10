"use client";

import { useId, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useWatch, type Control } from "react-hook-form";
import { Landmark } from "lucide-react";
import { settingsSectionSchemas } from "@/lib/settings/schema";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildSectionPatch } from "./model";
import { useSettingsPage } from "./settings-context";
import {
  fieldClass,
  SaveBar,
  saveSections,
  SectionFormProvider,
  SectionHeading,
  SettingsCard,
  settingsFieldFor,
  useSettingsForm,
} from "./settings-form";

type PaymentForm = {
  bankName: string;
  bankCode: string;
  accountName: string;
  accountNumber: string;
};

const Field = settingsFieldFor<PaymentForm>();

const schema = settingsSectionSchemas.payment;

export function PaymentSection() {
  const t = useTranslations("Settings.payment");
  const headingId = useId();
  const { data } = useSettingsPage();
  const p = data.values.payment;
  const initial = useMemo<PaymentForm>(
    () => ({
      bankName: String(p.bankName),
      bankCode: String(p.bankCode),
      accountName: String(p.accountName),
      accountNumber: String(p.accountNumber),
    }),
    [p]
  );

  const { form, formRef, submit, saving, isDirty, discard, api } = useSettingsForm<PaymentForm, PaymentForm>({
    tab: "payment",
    schema,
    initial,
    toForm: (output) => output,
    save: (output, changed) =>
      saveSections([["payment", buildSectionPatch("payment", changed, output)]]),
  });

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <SectionHeading id={headingId} icon={Landmark} title={t("title")} description={t("description")} />
      <SectionFormProvider api={api}>
        <Form {...form}>
          <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <SettingsCard title={t("accountTitle")} description={t("accountDescription")}>
                <div className="grid gap-x-4 gap-y-5 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <Field section="payment" name="bankName" label={t("bankName")}>
                    {(field) => (
                      <Input {...field} placeholder={t("bankNamePlaceholder")} className={fieldClass} />
                    )}
                  </Field>
                  <Field section="payment" name="bankCode" label={t("bankCode")}>
                    {(field) => (
                      <Input
                        {...field}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="012"
                        className={cn(fieldClass, "tabular-nums")}
                      />
                    )}
                  </Field>
                  <Field
                    section="payment"
                    name="accountName"
                    label={t("accountName")}
                    className="sm:col-span-2"
                  >
                    {(field) => (
                      <Input {...field} placeholder={t("accountNamePlaceholder")} className={fieldClass} />
                    )}
                  </Field>
                  <Field
                    section="payment"
                    name="accountNumber"
                    label={t("accountNumber")}
                    className="sm:col-span-2"
                  >
                    {(field) => (
                      <Input
                        {...field}
                        inputMode="numeric"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="0000-000-000000"
                        className={cn(fieldClass, "font-mono tabular-nums")}
                      />
                    )}
                  </Field>
                </div>
              </SettingsCard>
              <div className="xl:sticky xl:top-24">
                <PaymentPreview control={form.control} />
              </div>
            </div>
            <SaveBar dirty={isDirty} saving={saving} onDiscard={discard} />
          </form>
        </Form>
      </SectionFormProvider>
    </section>
  );
}

function PaymentPreview({ control }: { control: Control<PaymentForm> }) {
  const t = useTranslations("Settings.payment");
  const { data } = useSettingsPage();
  const values = useWatch({ control }) as Partial<PaymentForm>;
  const accent = String(data.values.appearance.brandColor);
  const rows = (
    [
      ["bankName", values.bankName],
      ["bankCode", values.bankCode],
      ["accountName", values.accountName],
      ["accountNumber", values.accountNumber],
    ] as const
  ).filter(([, value]) => value?.trim());

  return (
    <figure className="rounded-xl border bg-card p-4 shadow-card">
      <figcaption className="mb-3 text-sm font-semibold tracking-tight">{t("previewTitle")}</figcaption>
      {rows.length ? (
        <div aria-hidden="true" className="rounded-lg bg-paper p-4 text-paper-foreground ring-1 ring-black/5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
            {t("previewHeading")}
          </p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px] leading-relaxed">
            {rows.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-slate-500">{t(key)}</dt>
                <dd className={cn("break-words text-slate-900", key === "accountNumber" && "font-mono")}>
                  {value?.trim()}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {t("previewEmpty")}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{t("previewCaption")}</p>
    </figure>
  );
}
