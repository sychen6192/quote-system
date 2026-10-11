"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, MailCheck, MailWarning } from "lucide-react";
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

  // An address typed into the CC field but not added yet: Save must not stay
  // disabled, and Discard clears it (remounting the field).
  const [ccPending, setCcPending] = useState(false);
  const [ccKey, setCcKey] = useState(0);
  const clearCcDraft = useCallback(() => {
    setCcPending(false);
    setCcKey((key) => key + 1);
  }, []);

  const { form, formRef, submit, saving, isDirty, discard, api } = useSettingsForm<EmailForm, EmailForm>({
    tab: "email",
    schema,
    initial,
    toForm: (output) => ({ ...output, ccEmails: [...output.ccEmails] }),
    save: (output, changed) => saveSections([["mail", buildSectionPatch("mail", changed, output)]]),
    pendingInput: ccPending,
    onDiscard: clearCcDraft,
  });

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <SectionHeading id={headingId} icon={Mail} title={t("title")} />

      <p
        className={cn(
          "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold",
          data.mailEnabled
            ? "border-success/40 bg-success/10 text-success"
            : "border-warning/50 bg-warning/10 text-warning"
        )}
      >
        {data.mailEnabled ? (
          <MailCheck aria-hidden="true" className="size-5 shrink-0" />
        ) : (
          <MailWarning aria-hidden="true" className="size-5 shrink-0" />
        )}
        {data.mailEnabled ? t("statusOn") : t("statusOff")}
      </p>

      <SectionFormProvider api={api}>
        <Form {...form}>
          <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
            <SettingsCard title={t("senderTitle")}>
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <Field
                  section="mail"
                  name="senderName"
                  label={t("senderName")}
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
                  description={t("senderEmailHint")}
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
                      key={ccKey}
                      onPendingChange={setCcPending}
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
