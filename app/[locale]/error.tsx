"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowLeft, RotateCw } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { IconIllustration } from "@/components/app-shell/empty-state";

export default function ErrorPage({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Next 16.4+: re-fetches the segment's server data before re-rendering. */
  retry?: () => void;
}) {
  const t = useTranslations("Errors");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
    // Move focus so screen-reader and keyboard users land on the message.
    headingRef.current?.focus();
  }, [error]);

  const tryAgain = retry ?? reset;

  return (
    <section
      aria-labelledby="error-title"
      className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-5 px-4 py-16 text-center"
    >
      <IconIllustration icon={AlertTriangle} tone="destructive" />
      <div className="space-y-2">
        <h1
          id="error-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
        >
          {t("error.title")}
        </h1>
        <p className="leading-relaxed text-muted-foreground">{t("error.description")}</p>
        {error.digest ? (
          <p className="pt-1">
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              {t("error.reference", { digest: error.digest })}
            </code>
          </p>
        ) : null}
      </div>
      <div className="mt-1 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button type="button" onClick={() => tryAgain()} className="h-11 rounded-lg sm:h-10">
          <RotateCw aria-hidden="true" />
          {t("error.retry")}
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-lg bg-card sm:h-10">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            {t("backToDashboard")}
          </Link>
        </Button>
      </div>
    </section>
  );
}
