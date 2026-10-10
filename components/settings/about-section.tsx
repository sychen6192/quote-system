"use client";

import { useId, useSyncExternalStore, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  BookOpen,
  CircleCheck,
  Database,
  Download,
  ExternalLink,
  Info,
  Lock,
  LockOpen,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSettingsPage } from "./settings-context";
import { SectionHeading, SettingsCard } from "./settings-form";

const REPO = "https://github.com/sychen6192/quote-system";

// README section anchors (GitHub slugs of the headings).
const DOCS: Record<"en" | "zh-TW", Record<"readme" | "https" | "backup" | "upgrade", string>> = {
  en: {
    readme: `${REPO}/blob/main/README.md`,
    https: `${REPO}/blob/main/README.md#https-and-installing-on-phones`,
    backup: `${REPO}/blob/main/README.md#backup-and-restore`,
    upgrade: `${REPO}/blob/main/README.md#upgrading`,
  },
  "zh-TW": {
    readme: `${REPO}/blob/main/README.zh-TW.md`,
    https: `${REPO}/blob/main/README.zh-TW.md#https-與手機安裝`,
    backup: `${REPO}/blob/main/README.zh-TW.md#備份與還原`,
    upgrade: `${REPO}/blob/main/README.zh-TW.md#升級`,
  },
};

type InstallState = "installed" | "needsHttps" | "available";

function readInstallState(): InstallState {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true) {
    return "installed";
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  return window.isSecureContext || local ? "available" : "needsHttps";
}

const noSubscribe = () => () => {};

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

function DocLink({ href, icon: Icon, title, description }: {
  href: string;
  icon: typeof BookOpen;
  title: string;
  description: string;
}) {
  const t = useTranslations("Settings.about");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-11 items-start gap-3 rounded-lg border bg-background/50 p-3 transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {title}
          <ExternalLink aria-hidden="true" className="size-3.5 text-muted-foreground" />
          <span className="sr-only">{t("opensInNewTab")}</span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </a>
  );
}

export function AboutSection() {
  const t = useTranslations("Settings.about");
  const locale = useLocale();
  const headingId = useId();
  const { data } = useSettingsPage();
  const docs = DOCS[locale === "zh-TW" ? "zh-TW" : "en"];
  const install = useSyncExternalStore<InstallState | null>(noSubscribe, readInstallState, () => null);
  const code = (chunks: ReactNode) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em] text-foreground">{chunks}</code>
  );

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <SectionHeading id={headingId} icon={Info} title={t("title")} description={t("description")} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SettingsCard title={t("appTitle")}>
          <dl className="divide-y">
            <Row label={t("version")}>
              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs tabular-nums">
                {data.appVersion ? `v${data.appVersion}` : "—"}
              </span>
            </Row>
            <Row label={t("storage")}>{t("storageValue")}</Row>
            <Row label={t("email")}>
              <span className={cn("inline-flex items-center gap-1.5", data.mailEnabled ? "text-success" : "text-muted-foreground")}>
                <span aria-hidden="true" className={cn("size-2 rounded-full", data.mailEnabled ? "bg-success" : "bg-muted-foreground/60")} />
                {data.mailEnabled ? t("on") : t("off")}
              </span>
            </Row>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">{t("precedence")}</p>
        </SettingsCard>

        <SettingsCard
          title={t("securityTitle")}
          action={
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                data.authEnabled ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              )}
            >
              {data.authEnabled ? (
                <Lock aria-hidden="true" className="size-3.5" />
              ) : (
                <LockOpen aria-hidden="true" className="size-3.5" />
              )}
              {data.authEnabled ? t("authOn") : t("authOff")}
            </span>
          }
        >
          <p className="text-sm text-muted-foreground">
            {data.authEnabled ? t.rich("authOnBody", { code }) : t.rich("authOffBody", { code })}
          </p>
          {data.authEnabled ? (
            <div className="mt-4">
              <LogoutButton variant="outline" size="default" className="h-11 md:h-9" />
            </div>
          ) : (
            <p className="mt-3 flex items-start gap-2 text-sm text-warning">
              <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {t("authOffWarning")}
            </p>
          )}
        </SettingsCard>

        <SettingsCard title={t("installTitle")} description={t("installDescription")}>
          {install === "installed" ? (
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <CircleCheck aria-hidden="true" className="size-4" />
              {t("installed")}
            </p>
          ) : (
            <div className="space-y-3">
              <InstallAppButton variant="menu" />
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <Smartphone aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>{t("installIos")}</span>
                </li>
                <li className="flex gap-2">
                  <Download aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>{t("installOther")}</span>
                </li>
              </ul>
              {install === "needsHttps" ? (
                <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                  <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {t("installNeedsHttps")}{" "}
                    <a href={docs.https} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">
                      {t("httpsGuide")}
                    </a>
                  </span>
                </p>
              ) : null}
            </div>
          )}
        </SettingsCard>

        <SettingsCard title={t("dataTitle")} description={t("dataDescription")}>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-11 md:h-9">
              <a href={`/api/export/quotes?lang=${encodeURIComponent(locale)}`} download>
                <Download aria-hidden="true" />
                {t("export")}
              </a>
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {t.rich("backupBody", { code })}
          </p>
        </SettingsCard>
      </div>

      <SettingsCard title={t("docsTitle")} description={t("docsDescription")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <DocLink href={docs.readme} icon={BookOpen} title={t("docs.readme")} description={t("docs.readmeHint")} />
          <DocLink href={docs.https} icon={Lock} title={t("docs.https")} description={t("docs.httpsHint")} />
          <DocLink href={docs.backup} icon={Database} title={t("docs.backup")} description={t("docs.backupHint")} />
          <DocLink href={docs.upgrade} icon={Download} title={t("docs.upgrade")} description={t("docs.upgradeHint")} />
        </div>
      </SettingsCard>
    </section>
  );
}
