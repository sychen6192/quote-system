"use client";

import { useState, type ElementType, type ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronRight, Download, Ellipsis, MonitorDown, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useAppConfig } from "@/components/providers/app-config-provider";
import { shortAppName } from "@/components/app-shell/brand-name";
import { installUi, type InstallUi } from "@/lib/pwa/platform";
import { cn } from "@/lib/utils";
import { promptInstall } from "./install-prompt-store";
import { useInstallPlatform, useInstallPrompt, useStandalone } from "./use-pwa";

type ManualUi = Extract<InstallUi, "ios" | "macSafari">;

function useInstallUi(): InstallUi {
  const standalone = useStandalone();
  const platform = useInstallPlatform();
  const { prompt } = useInstallPrompt();
  return installUi({ standalone, canPrompt: prompt !== null, platform });
}

/** An inline icon "key" inside a sentence, like the button the user should look for. */
function KeyIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="mx-0.5 inline-flex size-[1.375rem] -translate-y-px items-center justify-center rounded-md border bg-background align-middle text-foreground shadow-sm [&_svg]:size-3.5"
    >
      {children}
    </span>
  );
}

function Step({ index, children }: { index: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary"
      >
        {index}
      </span>
      <span className="min-w-0 flex-1 text-sm leading-6">{children}</span>
    </li>
  );
}

type ManualStepsProps = {
  ui: ManualUi;
  onDone: () => void;
  /** SheetTitle / SheetDescription inside a sheet (it needs an accessible name). */
  titleAs?: ElementType;
  descriptionAs?: ElementType;
};

function ManualSteps({ ui, onDone, titleAs: Title = "p", descriptionAs: Description = "p" }: ManualStepsProps) {
  const t = useTranslations("Pwa.install");
  const { appName: fullName, iconUrl } = useAppConfig();
  // The Home Screen label (apple-mobile-web-app-title) is the short name.
  const appName = shortAppName(fullName);
  const rich = {
    b: (chunks: ReactNode) => <strong className="font-semibold text-foreground">{chunks}</strong>,
    share: () => (
      <KeyIcon>
        <Share />
      </KeyIcon>
    ),
    more: () => (
      <KeyIcon>
        <Ellipsis />
      </KeyIcon>
    ),
    add: () => (
      <KeyIcon>
        <SquarePlus />
      </KeyIcon>
    ),
    name: appName,
  };
  const steps =
    ui === "ios"
      ? [t.rich("ios.step1", rich), t.rich("ios.step2", rich), t.rich("ios.step3", rich)]
      : [t.rich("mac.step1", rich), t.rich("mac.step2", rich)];
  const prefix = ui === "ios" ? "ios" : "mac";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 pr-6">
        <Image
          src={iconUrl}
          alt=""
          width={40}
          height={40}
          unoptimized
          className="size-10 shrink-0 rounded-xl bg-white object-contain p-0.5 shadow-card ring-1 ring-border"
        />
        <div className="min-w-0 space-y-0.5">
          <Title className="text-sm font-semibold leading-5 text-foreground">{t(`${prefix}.title`)}</Title>
          <Description className="text-xs leading-5 text-muted-foreground">
            {t(`${prefix}.intro`, { name: appName })}
          </Description>
        </div>
      </div>
      <ol className="space-y-3 border-t pt-4 text-muted-foreground">
        {steps.map((step, i) => (
          <Step key={i} index={i + 1}>
            {step}
          </Step>
        ))}
      </ol>
      <Button type="button" variant="secondary" className="h-11 w-full md:h-9" onClick={onDone}>
        {t("gotIt")}
      </Button>
    </div>
  );
}

/**
 * Step-by-step help: a popover by the button on wider screens, a bottom sheet
 * on phones (closer to the browser's own Share button, and never cut off).
 */
function ManualHelp({ ui, children, align }: { ui: ManualUi; children: ReactNode; align: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const wide = useMediaQuery("(min-width: 768px)");
  const t = useTranslations("UI");
  const done = () => setOpen(false);

  if (!wide) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent side="bottom" closeLabel={t("close")} className="px-5 pt-6">
          <div className="mx-auto w-full max-w-md">
            <ManualSteps ui={ui} onDone={done} titleAs={SheetTitle} descriptionAs={SheetDescription} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} sideOffset={8} collisionPadding={16} className="w-80 rounded-xl p-4 shadow-elevated">
        <ManualSteps ui={ui} onDone={done} />
      </PopoverContent>
    </Popover>
  );
}

function IconVariant({ ui }: { ui: Exclude<InstallUi, "hidden"> }) {
  const t = useTranslations("Pwa.install");
  const label = t("button");
  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className="h-11 w-11 md:h-9 md:w-9"
      onClick={ui === "prompt" ? () => void promptInstall() : undefined}
    >
      {ui === "ios" ? (
        <SquarePlus aria-hidden="true" />
      ) : (
        <>
          <Download aria-hidden="true" className="md:hidden" />
          <MonitorDown aria-hidden="true" className="hidden md:block" />
        </>
      )}
    </Button>
  );
  if (ui === "prompt") return trigger;
  return (
    <ManualHelp ui={ui} align="end">
      {trigger}
    </ManualHelp>
  );
}

function MenuVariant({ ui }: { ui: Exclude<InstallUi, "hidden"> }) {
  const t = useTranslations("Pwa.install");
  const { iconUrl } = useAppConfig();
  const description = ui === "prompt" ? t("rowPrompt") : ui === "ios" ? t("rowIos") : t("rowMac");

  const row = (
    <button
      type="button"
      onClick={ui === "prompt" ? () => void promptInstall() : undefined}
      className={cn(
        "group flex min-h-14 w-full items-center gap-3 rounded-lg border bg-background/50 p-3 text-left transition-colors",
        "hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <Image
        src={iconUrl}
        alt=""
        width={40}
        height={40}
        unoptimized
        className="size-10 shrink-0 rounded-xl bg-white object-contain p-0.5 shadow-card ring-1 ring-border"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{t("rowTitle")}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      {ui === "prompt" ? (
        <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors group-hover:bg-primary/90 [&_svg]:size-3.5">
          <Download aria-hidden="true" />
          {t("install")}
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary">
          {t("showSteps")}
          <ChevronRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </button>
  );
  if (ui === "prompt") return row;
  return (
    <ManualHelp ui={ui} align="start">
      {row}
    </ManualHelp>
  );
}

/**
 * Install entry point: the browser's prompt (Chromium), or step-by-step help
 * for iOS / iPadOS and Safari on macOS. Renders nothing when installed or
 * when the browser offers neither (also during SSR and hydration).
 * `icon`: top-bar button. `menu`: full-width row for Settings.
 */
export function InstallAppButton({ variant = "icon" }: { variant?: "icon" | "menu" }) {
  const ui = useInstallUi();
  if (ui === "hidden") return null;
  return variant === "menu" ? <MenuVariant ui={ui} /> : <IconVariant ui={ui} />;
}
