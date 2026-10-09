"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowLeft, RotateCw } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";

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
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10"
        aria-hidden="true"
      >
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <h1
        id="error-title"
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight outline-none"
      >
        {t("error.title")}
      </h1>
      <p className="text-muted-foreground">{t("error.description")}</p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          {t("error.reference", { digest: error.digest })}
        </p>
      ) : null}
      <div className="mt-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button type="button" onClick={() => tryAgain()}>
          <RotateCw aria-hidden="true" />
          {t("error.retry")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            {t("backToDashboard")}
          </Link>
        </Button>
      </div>
    </section>
  );
}
