"use client";

import { useId, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useWatch, type Control } from "react-hook-form";
import { Building2, ImageIcon } from "lucide-react";
import { settingsSectionSchemas } from "@/lib/settings/schema";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buildSectionPatch } from "./model";
import { previewPattern } from "./number-pattern";
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

type CompanyForm = {
  name: string;
  nameLocal: string;
  address: string;
  vatNumber: string;
  email: string;
  phone: string;
  website: string;
};

const Field = settingsFieldFor<CompanyForm>();

const schema = settingsSectionSchemas.company;

export function CompanySection() {
  const t = useTranslations("Settings.company");
  const headingId = useId();
  const { data, goTo } = useSettingsPage();
  const values = data.values.company;
  const nameIsPlaceholder = data.meta.company.name?.source === "default";

  const initial = useMemo<CompanyForm>(
    () => ({
      // The built-in "Your Company" is a placeholder, not something to edit.
      name: nameIsPlaceholder ? "" : String(values.name),
      nameLocal: String(values.nameLocal),
      address: String(values.address),
      vatNumber: String(values.vatNumber),
      email: String(values.email),
      phone: String(values.phone),
      website: String(values.website),
    }),
    [values, nameIsPlaceholder]
  );

  const { form, formRef, submit, saving, isDirty, discard, api } = useSettingsForm<
    CompanyForm,
    CompanyForm
  >({
    tab: "company",
    schema,
    initial,
    toForm: (output) => output,
    save: (output, changed) =>
      saveSections([["company", buildSectionPatch("company", changed, output)]]),
  });

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <SectionHeading id={headingId} icon={Building2} title={t("title")} />
      <SectionFormProvider api={api}>
        <Form {...form}>
          <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <SettingsCard title={t("detailsTitle")}>
                <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                  <Field section="company" name="name" label={t("name")}>
                    {(field) => (
                      <Input
                        {...field}
                        autoComplete="organization"
                        placeholder={t("namePlaceholder")}
                        className={fieldClass}
                      />
                    )}
                  </Field>
                  <Field
                    section="company"
                    name="nameLocal"
                    label={t("nameLocal")}
                  >
                    {(field) => (
                      <Input {...field} placeholder={t("nameLocalPlaceholder")} className={fieldClass} />
                    )}
                  </Field>
                  <Field
                    section="company"
                    name="address"
                    label={t("address")}
                    className="sm:col-span-2"
                  >
                    {(field) => (
                      <Textarea
                        {...field}
                        rows={2}
                        autoComplete="street-address"
                        placeholder={t("addressPlaceholder")}
                        className="max-h-60 min-h-[4.5rem] resize-y [field-sizing:content]"
                      />
                    )}
                  </Field>
                  <Field
                    section="company"
                    name="vatNumber"
                    label={t("vatNumber")}
                  >
                    {(field) => (
                      <Input
                        {...field}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder={t("vatNumberPlaceholder")}
                        className={cn(fieldClass, "tabular-nums")}
                      />
                    )}
                  </Field>
                  <Field section="company" name="phone" label={t("phone")}>
                    {(field) => (
                      <Input
                        {...field}
                        type="tel"
                        autoComplete="tel"
                        placeholder={t("phonePlaceholder")}
                        className={fieldClass}
                      />
                    )}
                  </Field>
                  <Field section="company" name="email" label={t("email")}>
                    {(field) => (
                      <Input
                        {...field}
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="hello@example.com"
                        className={fieldClass}
                      />
                    )}
                  </Field>
                  <Field section="company" name="website" label={t("website")}>
                    {(field) => (
                      <Input
                        {...field}
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        placeholder="https://example.com"
                        className={fieldClass}
                      />
                    )}
                  </Field>
                </div>
              </SettingsCard>

              <div className="xl:sticky xl:top-24">
                <HeaderPreview control={form.control} onEditLogo={() => goTo("branding")} />
              </div>
            </div>
            <SaveBar dirty={isDirty} saving={saving} onDiscard={discard} />
          </form>
        </Form>
      </SectionFormProvider>
    </section>
  );
}

/** A live miniature of the document header (logo, company block, title). */
function HeaderPreview({
  control,
  onEditLogo,
}: {
  control: Control<CompanyForm>;
  onEditLogo: () => void;
}) {
  const t = useTranslations("Settings.company.preview");
  const { data } = useSettingsPage();
  const company = useWatch({ control }) as Partial<CompanyForm>;
  const accent = String(data.values.appearance.brandColor);
  const number = previewPattern(String(data.values.quote.numberPattern), data.today);
  const name = company.name?.trim() || t("namePlaceholder");
  const contact = [company.phone, company.email, company.website]
    .map((part) => part?.trim())
    .filter(Boolean);

  return (
    <figure className="rounded-xl border bg-card p-4 shadow-card">
      <figcaption className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tracking-tight">{t("title")}</span>
        <button
          type="button"
          onClick={onEditLogo}
          className="relative inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary underline-offset-4 after:absolute after:-inset-3 after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ImageIcon aria-hidden="true" className="size-3.5" />
          {t("changeLogo")}
        </button>
      </figcaption>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-lg bg-paper text-paper-foreground shadow-sm ring-1 ring-black/5"
      >
        <div className="h-1.5" style={{ backgroundColor: accent }} />
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- cache-busted API image, no optimisation */}
            <img
              src={`/api/branding/logo?v=${encodeURIComponent(data.version)}`}
              alt=""
              className="h-9 max-w-[7rem] object-contain object-left"
            />
            <div className="text-right">
              <p className="text-[13px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                {t("document")}
              </p>
              {number.ok ? (
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">{number.example}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-0.5 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-600">
            <p
              className={cn(
                "break-words text-[13px] font-semibold text-slate-900",
                !company.name?.trim() && "italic text-slate-400"
              )}
            >
              {name}
            </p>
            {company.nameLocal?.trim() ? (
              <p className="break-words text-xs font-medium text-slate-700">{company.nameLocal}</p>
            ) : null}
            {company.address?.trim() ? (
              <p className="whitespace-pre-line break-words">{company.address.trim()}</p>
            ) : null}
            {company.vatNumber?.trim() ? (
              <p>
                {t("vat")} <span className="tabular-nums">{company.vatNumber.trim()}</span>
              </p>
            ) : null}
            {contact.length ? <p className="break-words">{contact.join(" · ")}</p> : null}
          </div>
        </div>
      </div>
    </figure>
  );
}
