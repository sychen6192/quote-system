"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Download, Loader2, MailWarning, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { sendQuoteEmail, type SendEmailResult } from "@/actions/send-email";
import { reloadForSignIn } from "@/components/app-shell/session";
import { DownloadLink } from "@/components/app-shell/download-link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LOCALES, type AppLocale } from "@/i18n/locales";
import { cn } from "@/lib/utils";
import { Link, useRouter } from "@/navigation";
import { useQuoteDetail } from "./detail-context";
import { MAX_CC, looksLikeEmail, splitEmailList } from "./model";

const MAX_MESSAGE = 2000;

type Field = "to" | "cc" | "message";
type Errors = Partial<Record<Field, string>>;

/** Server fieldErrors ("cc.1": ["invalidEmail"]) → one Validation key per field. */
function fieldErrorsOf(fieldErrors: Record<string, string[] | undefined>): Errors {
  const errors: Errors = {};
  for (const [path, keys] of Object.entries(fieldErrors)) {
    const field = path.split(".")[0];
    if ((field === "to" || field === "cc" || field === "message") && keys?.[0]) {
      errors[field] ??= keys[0];
    }
  }
  return errors;
}

export function SendEmailDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("QuoteActions.email");
  const tActions = useTranslations("QuoteActions");
  const tv = useTranslations("Validation");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const { quote, status, downloadHref } = useQuoteDetail();
  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;

  const [to, setTo] = useState(quote.customerEmail ?? "");
  const [cc, setCc] = useState("");
  const [message, setMessage] = useState("");
  const [lang, setLang] = useState<AppLocale>(quote.locale);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const toRef = useRef<HTMLInputElement>(null);
  const ccRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const submitRef = useRef<() => void>(() => {});

  const focusField = (field: Field) => {
    const target = { to: toRef, cc: ccRef, message: messageRef }[field].current;
    target?.focus();
  };

  const showErrors = (next: Errors) => {
    setErrors(next);
    const first = (["to", "cc", "message"] as const).find((field) => next[field]);
    if (first) window.setTimeout(() => focusField(first), 0);
  };

  const validate = (): Errors => {
    const next: Errors = {};
    const recipient = to.trim();
    if (!recipient) next.to = "required";
    else if (!looksLikeEmail(recipient)) next.to = "invalidEmail";
    const ccList = splitEmailList(cc);
    if (ccList.some((email) => !looksLikeEmail(email))) next.cc = "invalidEmail";
    else if (ccList.length > MAX_CC) next.cc = "tooManyRecipients";
    if (message.length > MAX_MESSAGE) next.message = "messageTooLong";
    return next;
  };

  const handleResult = (result: SendEmailResult, recipient: string) => {
    const retry = { label: t("retry"), onClick: () => submitRef.current() };
    // Long enough to reach the Retry button (sonner's default is 4 s).
    const actionable = { action: retry, duration: 10_000 };
    if (result.success) {
      toast.success(t("success", { email: recipient }), {
        description: status === "draft" ? t("successDraft") : undefined,
      });
      setMessage("");
      setCc("");
      onOpenChange(false);
      return;
    }
    switch (result.code) {
      case "VALIDATION": {
        const next = fieldErrorsOf(result.fieldErrors);
        showErrors(next);
        toast.error(t("errors.invalid"));
        return;
      }
      case "NO_RECIPIENT":
        showErrors({ to: "required" });
        toast.error(t("errors.noRecipient"));
        return;
      case "RATE_LIMITED":
        toast.error(
          t("errors.rateLimited", { minutes: Math.max(1, Math.ceil(result.retryAfterMs / 60_000)) }),
          actionable
        );
        return;
      case "SEND_FAILED":
      case "INTERNAL":
        toast.error(t("errors.sendFailed"), actionable);
        return;
      case "MAIL_DISABLED":
        toast.error(t("errors.mailDisabled"));
        return;
      case "NOT_FOUND":
        toast.error(t("errors.notFound"));
        onOpenChange(false);
        router.push("/quotes");
        return;
      case "UNAUTHORIZED":
        reloadForSignIn(tCommon("sessionExpired"));
        return;
    }
  };

  const submit = async () => {
    if (pending || !quote.mailEnabled) return;
    const next = validate();
    if (Object.keys(next).length) {
      showErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    const recipient = to.trim();
    let result: SendEmailResult;
    try {
      result = await sendQuoteEmail({
        id: quote.id,
        to: recipient,
        cc: splitEmailList(cc),
        message: message.trim(),
        locale: lang,
      });
    } catch (error) {
      console.error(error);
      setPending(false);
      reloadForSignIn(tCommon("sessionExpired"));
      return;
    }
    setPending(false);
    handleResult(result, recipient);
  };

  useEffect(() => {
    submitRef.current = () => void submit();
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const disabled = !quote.mailEnabled;
  const describedBy = (field: Field, hint?: string) =>
    [hint, errors[field] ? id(`${field}-error`) : null].filter(Boolean).join(" ") || undefined;

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent
        className="gap-0 p-0 sm:max-w-lg"
        closeLabel={t("cancel")}
        // Prefilled recipient: focus the dialog itself rather than the field,
        // so phones do not open the keyboard straight away.
        onOpenAutoFocus={(event) => {
          if (!to) return;
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
        // A failure toast's Retry must stay clickable without closing the dialog.
      >
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader className="space-y-1 border-b px-5 pb-4 pt-5 text-left sm:px-6">
            <DialogTitle className="pr-8 text-lg">{t("title")}</DialogTitle>
            <DialogDescription>
              {t(disabled ? "descriptionDisabled" : "description", { number: quote.quotationNumber })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            {disabled ? (
              <div
                role="note"
                className="flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3.5 text-sm text-foreground"
              >
                <MailWarning aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
                <div className="space-y-1">
                  <p className="font-semibold">{t("disabled.title")}</p>
                  {/* Not muted-foreground: that is about 4.1:1 on the warning tint. */}
                  <p className="text-foreground/80">{t("disabled.description")}</p>
                  <Link
                    href="/settings"
                    className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline sm:min-h-0 sm:pt-1"
                  >
                    {t("disabled.settings")}
                  </Link>
                </div>
              </div>
            ) : null}

            {disabled ? null : (
              <fieldset disabled={pending} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor={id("to")}>{t("to")}</Label>
                  <Input
                    ref={toRef}
                    id={id("to")}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={t("toPlaceholder")}
                    value={to}
                    onChange={(event) => {
                      setTo(event.target.value);
                      if (errors.to) setErrors((current) => ({ ...current, to: undefined }));
                    }}
                    aria-invalid={errors.to ? true : undefined}
                    aria-describedby={describedBy("to")}
                    className="h-11 md:h-10"
                  />
                  <FieldError id={id("to-error")}>{errors.to ? tv(errors.to) : null}</FieldError>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={id("cc")}>
                    {t("cc")} <span className="font-normal text-muted-foreground">· {t("optional")}</span>
                  </Label>
                  <Input
                    ref={ccRef}
                    id={id("cc")}
                    type="text"
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={cc}
                    onChange={(event) => {
                      setCc(event.target.value);
                      if (errors.cc) setErrors((current) => ({ ...current, cc: undefined }));
                    }}
                    aria-invalid={errors.cc ? true : undefined}
                    aria-describedby={describedBy("cc", id("cc-hint"))}
                    className="h-11 md:h-10"
                  />
                  <p id={id("cc-hint")} className="text-xs text-muted-foreground">
                    {t("ccHint")}
                  </p>
                  <FieldError id={id("cc-error")}>{errors.cc ? tv(errors.cc) : null}</FieldError>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <Label htmlFor={id("message")}>
                      {t("message")} <span className="font-normal text-muted-foreground">· {t("optional")}</span>
                    </Label>
                    <span
                      id={id("message-count")}
                      className={cn(
                        "text-xs tabular-nums text-muted-foreground",
                        message.length > MAX_MESSAGE * 0.9 && "text-warning"
                      )}
                    >
                      {t("messageCount", { count: message.length, max: MAX_MESSAGE })}
                    </span>
                  </div>
                  <Textarea
                    ref={messageRef}
                    id={id("message")}
                    rows={4}
                    maxLength={MAX_MESSAGE}
                    placeholder={t("messagePlaceholder")}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={describedBy("message", id("message-count"))}
                    className="min-h-[104px] resize-y"
                  />
                  <FieldError id={id("message-error")}>{errors.message ? tv(errors.message) : null}</FieldError>
                </div>

                <div className="space-y-2">
                  <p id={id("lang")} className="text-sm font-medium leading-none">
                    {t("language")}
                  </p>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={lang}
                    onValueChange={(value) => value && setLang(value as AppLocale)}
                    aria-labelledby={id("lang")}
                    className="justify-start"
                  >
                    {LOCALES.map((locale) => (
                      <ToggleGroupItem key={locale} value={locale} lang={locale} className="h-11 px-4 md:h-9">
                        {t(`languages.${locale}`)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </fieldset>
            )}
          </div>

          <DialogFooter className="gap-2 border-t px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="h-11 md:h-9"
            >
              {t("cancel")}
            </Button>
            {disabled ? (
              <Button asChild className="h-11 md:h-9">
                <DownloadLink href={downloadHref} onClick={() => onOpenChange(false)}>
                  <Download aria-hidden="true" />
                  {tActions("downloadPdf")}
                </DownloadLink>
              </Button>
            ) : (
              <Button type="submit" disabled={pending} className="h-11 min-w-36 md:h-9">
                {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
                {pending ? t("sending") : t("submit")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
