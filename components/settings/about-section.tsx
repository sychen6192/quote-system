"use client";

import { useId, useSyncExternalStore, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleCheck, Download, Info, Lock, LockOpen, ShieldAlert, Smartphone } from "lucide-react";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { useInstallPlatform, useInstallPrompt, useStandalone } from "@/components/pwa/use-pwa";
import { installUi } from "@/lib/pwa/platform";
import { LogoutButton } from "@/components/auth/logout-button";
import { DownloadLink } from "@/components/app-shell/download-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSettingsPage } from "./settings-context";
import { SectionHeading, SettingsCard } from "./settings-form";

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

export function AboutSection() {
  const t = useTranslations("Settings.about");
  const locale = useLocale();
  const headingId = useId();
  const { data } = useSettingsPage();
  const install = useSyncExternalStore<InstallState | null>(noSubscribe, readInstallState, () => null);
  // What <InstallAppButton> offers here (the browser's prompt, or its own
  // iOS / Safari steps); the generic instructions are only for the rest.
  const standalone = useStandalone();
  const { prompt } = useInstallPrompt();
  const platform = useInstallPlatform();
  const installOffer = installUi({ standalone, canPrompt: prompt !== null, platform });

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <SectionHeading id={headingId} icon={Info} title={t("title")} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SettingsCard title={t("appTitle")}>
          <dl className="divide-y">
            <Row label={t("version")}>
              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs tabular-nums">
                {data.appVersion ? `v${data.appVersion}` : "—"}
              </span>
            </Row>
            <Row label={t("email")}>
              <span className={cn("inline-flex items-center gap-1.5", data.mailEnabled ? "text-success" : "text-muted-foreground")}>
                <span aria-hidden="true" className={cn("size-2 rounded-full", data.mailEnabled ? "bg-success" : "bg-muted-foreground/60")} />
                {data.mailEnabled ? t("on") : t("off")}
              </span>
            </Row>
            <Row label={t("signIn")}>
              <span className={cn("inline-flex items-center gap-1.5", data.authEnabled ? "text-success" : "text-warning")}>
                {data.authEnabled ? (
                  <Lock aria-hidden="true" className="size-3.5" />
                ) : (
                  <LockOpen aria-hidden="true" className="size-3.5" />
                )}
                {data.authEnabled ? t("on") : t("off")}
              </span>
            </Row>
          </dl>
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

        <SettingsCard title={t("installTitle")}>
          {install === "installed" ? (
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <CircleCheck aria-hidden="true" className="size-4" />
              {t("installed")}
            </p>
          ) : (
            <div className="space-y-3">
              {installOffer === "hidden" ? (
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
              ) : (
                <InstallAppButton variant="menu" />
              )}
              {install === "needsHttps" ? (
                <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                  <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {t("installNeedsHttps")}
                </p>
              ) : null}
            </div>
          )}
        </SettingsCard>

        <SettingsCard title={t("dataTitle")}>
          <Button asChild variant="outline" className="h-11 md:h-9">
            <DownloadLink href={`/api/export/quotes?lang=${encodeURIComponent(locale)}`}>
              <Download aria-hidden="true" />
              {t("export")}
            </DownloadLink>
          </Button>
        </SettingsCard>
      </div>
    </section>
  );
}
