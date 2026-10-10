"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarX2, Copy, Handshake, History, Send, UserCheck } from "lucide-react";
import { formatIsoDate } from "@/components/app-shell/format";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import type { DisplayStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

type Tone = "info" | "primary" | "warning";

const TONE: Record<Tone, { bar: string; icon: string }> = {
  info: { bar: "before:bg-info", icon: "bg-info/10 text-info" },
  primary: { bar: "before:bg-primary", icon: "bg-primary/10 text-primary" },
  warning: { bar: "before:bg-warning", icon: "bg-warning/10 text-warning" },
};

function Banner({
  icon,
  tone = "info",
  title,
  children,
  actions,
  className,
}: {
  icon: ReactNode;
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card py-3 pl-5 pr-4 shadow-card sm:flex-row sm:items-center",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        TONE[tone].bar,
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden="true"
          className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONE[tone].icon)}
        >
          {icon}
        </span>
        <div className="min-w-0 self-center text-sm">
          {title && <p className="font-semibold text-foreground">{title}</p>}
          {children && <div className="text-muted-foreground">{children}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 gap-2 sm:ml-auto">{actions}</div>}
    </div>
  );
}

export function DraftRestoreBanner({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("QuoteForm.banners");
  const locale = useLocale();
  // The device's own clock and zone: "when did I type this".
  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(savedAt);
  return (
    <section aria-label={t("draftTitle")}>
      <Banner
        tone="primary"
        icon={<History className="size-4" />}
        title={t("draftTitle")}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={onDiscard} className="h-11 flex-1 sm:h-9 sm:flex-none">
              {t("discard")}
            </Button>
            <Button type="button" onClick={onRestore} className="h-11 flex-1 sm:h-9 sm:flex-none">
              {t("restore")}
            </Button>
          </>
        }
      >
        {t("draftBody", { when })}
      </Banner>
    </section>
  );
}

export function DuplicatedBanner({ id, quotationNumber }: { id: number; quotationNumber: string }) {
  const t = useTranslations("QuoteForm.banners");
  return (
    <Banner
      icon={<Copy className="size-4" />}
      actions={
        <Button asChild variant="outline" className="h-11 w-full bg-background sm:h-9 sm:w-auto">
          <Link href={`/quotes/${id}`}>{t("viewOriginal")}</Link>
        </Button>
      }
    >
      {t.rich("duplicated", {
        number: quotationNumber,
        strong: (chunks) => <strong className="font-semibold text-foreground tabular-nums">{chunks}</strong>,
      })}
    </Banner>
  );
}

export function CustomerPrefilledBanner({ company }: { company: string }) {
  const t = useTranslations("QuoteForm.banners");
  return (
    <Banner icon={<UserCheck className="size-4" />}>
      {t.rich("customerPrefilled", {
        company,
        strong: (chunks) => <strong className="font-semibold text-foreground">{chunks}</strong>,
      })}
    </Banner>
  );
}

/**
 * Editing a quote the customer has already seen: say what saving will do,
 * and offer the safer path (a new validity date, or a duplicate).
 */
export function StatusNoticeBanner({
  quoteId,
  status,
  validUntil,
  onSetValidity,
}: {
  quoteId: number;
  status: DisplayStatus;
  validUntil: string;
  onSetValidity: () => void;
}) {
  const t = useTranslations("QuoteForm.banners");
  const locale = useLocale();
  const action = "h-11 w-full bg-background sm:h-9 sm:w-auto";
  switch (status) {
    case "expired":
      return (
        <Banner
          tone="warning"
          icon={<CalendarX2 className="size-4" />}
          actions={
            <Button type="button" variant="outline" onClick={onSetValidity} className={action}>
              {t("setValidity")}
            </Button>
          }
        >
          {t("statusExpired", { date: formatIsoDate(validUntil, locale) })}
        </Banner>
      );
    case "accepted":
      return (
        <Banner
          tone="warning"
          icon={<Handshake className="size-4" />}
          actions={
            <Button asChild variant="outline" className={action}>
              <Link href={`/quotes/new?from=${quoteId}`}>{t("duplicateInstead")}</Link>
            </Button>
          }
        >
          {t("statusAccepted")}
        </Banner>
      );
    case "sent":
      return <Banner icon={<Send className="size-4" />}>{t("statusSent")}</Banner>;
    default:
      return null;
  }
}
