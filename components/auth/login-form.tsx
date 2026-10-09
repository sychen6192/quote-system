"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type LoginError = "invalid" | "throttled";

export type LoginFormProps = {
  locale: string;
  /** Same-site path to return to after signing in (already sanitised). */
  next: string;
  error?: LoginError | null;
  /** Minutes until a throttled client may try again. */
  retryMinutes?: number;
};

const ERROR_ID = "login-error";

/**
 * A plain HTML form POST to /api/auth/login: it works before (or without)
 * JavaScript, and the route answers with a 303 back here or to `next`.
 */
export function LoginForm({ locale, next, error, retryMinutes }: LoginFormProps) {
  const t = useTranslations("Auth");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);

  // Coming back via the back button restores this page from the bfcache with
  // the spinner still showing.
  useEffect(() => {
    const onPageShow = () => setPending(false);
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const message =
    error === "throttled"
      ? t("errors.throttled", { minutes: retryMinutes ?? 15 })
      : error === "invalid"
        ? t("errors.invalid")
        : null;

  return (
    <form
      method="post"
      action="/api/auth/login"
      onSubmit={() => setPending(true)}
      className="space-y-5"
    >
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium leading-none">
          {t("passwordLabel")}
        </label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus
            maxLength={1024}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? ERROR_ID : undefined}
            className="h-11 pr-11 text-base"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={t("showPassword")}
            aria-pressed={visible}
            aria-controls="password"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {visible ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {message ? (
          <p
            id={ERROR_ID}
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{message}</span>
          </p>
        ) : null}
      </div>

      <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <LogIn aria-hidden="true" />
        )}
        {pending ? t("submitting") : t("submit")}
      </Button>

      {/* Last, so the visible fields are not offset by space-y. */}
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="locale" value={locale} />
      {/* Password-only form: a username lets password managers save the entry. */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        value="quote-system"
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
    </form>
  );
}
