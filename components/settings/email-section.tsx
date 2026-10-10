"use client";

import { useId, useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Mail, MailCheck, MailWarning } from "lucide-react";
import { MAX_CC_EMAILS, settingsSectionSchemas } from "@/lib/settings/schema";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildSectionPatch } from "./model";
import { useSettingsPage } from "./settings-context";
import { EmailChipsInput } from "./email-chips-input";
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

type EmailForm = {
  senderName: string;
  senderEmail: string;
  ccEmails: string[];
  replyTo: string;
};

const Field = settingsFieldFor<EmailForm>();

const schema = settingsSectionSchemas.mail;

const code = (chunks: ReactNode) => (
  <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.8em] text-foreground">
    {chunks}
  </code>
);

export function EmailSection() {
  const t = useTranslations("Settings.email");
  const headingId = useId();
  const { data } = useSettingsPage();
  const m = data.values.mail;
  const senderIsDefault = data.meta.mail.senderEmail?.source === "default";
  const senderFallback = String(data.meta.mail.senderEmail?.fallback ?? "");

  const initial = useMemo<EmailForm>(
    () => ({
      senderName: String(m.senderName),
      // Resend's shared test sender is the fallback, not a value to edit.
      senderEmail: senderIsDefault ? "" : String(m.senderEmail),
      ccEmails: Array.isArray(m.ccEmails) ? [...m.ccEmails] : [],
      replyTo: String(m.replyTo),
    }),
    [m, senderIsDefault]
  );

  const { form, formRef, submit, saving, isDirty, discard, api } = useSettingsForm<EmailForm, EmailForm>({
    tab: "email",
    schema,
    initial,
    toForm: (output) => ({ ...output, ccEmails: [...output.ccEmails] }),
    save: (output, changed) => saveSections([["mail", buildSectionPatch("mail", changed, output)]]),
  });

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <SectionHeading id={headingId} icon={Mail} title={t("title")} description={t("description")} />

      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border bg-card p-4 shadow-card",
          data.mailEnabled ? "border-success/40" : "border-warning/50"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            data.mailEnabled ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          )}
        >
          {data.mailEnabled ? <MailCheck className="size-5" /> : <MailWarning className="size-5" />}
        </span>
        <div className="min-w-0 space-y-1 text-sm">
          <p className={cn("font-semibold", data.mailEnabled ? "text-success" : "text-warning")}>
            {data.mailEnabled ? t("statusOn") : t("statusOff")}
          </p>
          <p className="text-muted-foreground">
            {data.mailEnabled ? t.rich("statusOnBody", { code }) : t.rich("statusOffBody", { code })}
          </p>
          {data.mailEnabled ? null : (
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-primary md:min-h-0"
            >
              {t("getKey")}
              <ExternalLink aria-hidden="true" className="size-3.5" />
              <span className="sr-only">{t("opensInNewTab")}</span>
            </a>
          )}
        </div>
      </div>

      <SectionFormProvider api={api}>
        <Form {...form}>
          <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
            <SettingsCard title={t("senderTitle")} description={t("senderDescription")}>
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <Field
                  section="mail"
                  name="senderName"
                  label={t("senderName")}
                  description={t("senderNameHint")}
                >
                  {(field) => (
                    <Input
                      {...field}
                      autoComplete="organization"
                      placeholder={data.companyName}
                      className={fieldClass}
                    />
                  )}
                </Field>
                <Field
                  section="mail"
                  name="senderEmail"
                  label={t("senderEmail")}
                  description={t.rich("senderEmailHint", { code, fallback: senderFallback })}
                >
                  {(field) => (
                    <Input
                      {...field}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={senderFallback}
                      className={fieldClass}
                    />
                  )}
                </Field>
                <Field
                  section="mail"
                  name="replyTo"
                  label={t("replyTo")}
                  description={t("replyToHint")}
                >
                  {(field) => (
                    <Input
                      {...field}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="sales@example.com"
                      className={fieldClass}
                    />
                  )}
                </Field>
                <Field
                  section="mail"
                  name="ccEmails"
                  label={t("ccEmails")}
                  description={t("ccEmailsHint", { max: MAX_CC_EMAILS })}
                  className="sm:col-span-2"
                >
                  {(field) => (
                    <EmailChipsInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      placeholder={t("ccPlaceholder")}
                    />
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
