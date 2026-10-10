"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Building2,
  Globe2,
  Info,
  Landmark,
  Loader2,
  Mail,
  Palette,
  ReceiptText,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { reloadForSignIn } from "@/components/app-shell/session";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TAB,
  HASH_TAB_ATTRIBUTE,
  SETTINGS_TABS,
  tabFromHash,
  type SettingsPageData,
  type SettingsTab,
} from "./model";
import { SettingsContext, type SectionHandle, type SettingsContextValue } from "./settings-context";
import { CompanySection } from "./company-section";
import { BrandingSection } from "./branding-section";
import { QuotesSection } from "./quotes-section";
import { PaymentSection } from "./payment-section";
import { EmailSection } from "./email-section";
import { RegionalSection } from "./regional-section";
import { AboutSection } from "./about-section";

export const TAB_ICONS: Record<SettingsTab, LucideIcon> = {
  company: Building2,
  branding: Palette,
  quotes: ReceiptText,
  payment: Landmark,
  email: Mail,
  regional: Globe2,
  about: Info,
};

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type PendingNavigation = { tab: SettingsTab } | { href: string };

function panelId(tab: SettingsTab) {
  return `settings-panel-${tab}`;
}

/** The same-origin page a click on `anchor` would open, or null if it stays here. */
function leavingHref(event: globalThis.MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return null;
  }
  return url.pathname + url.search + url.hash;
}

export function SettingsView({ data }: { data: SettingsPageData }) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState<SettingsTab>(DEFAULT_TAB);
  const [dirtyTabs, setDirtyTabs] = useState<ReadonlySet<SettingsTab>>(() => new Set());
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const [savingFromDialog, setSavingFromDialog] = useState(false);
  const handles = useRef(new Map<SettingsTab, SectionHandle>());
  const activeRef = useRef(active);
  const stripRef = useRef<HTMLUListElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const allowLeave = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const register = useCallback((tab: SettingsTab, handle: SectionHandle) => {
    handles.current.set(tab, handle);
    return () => {
      if (handles.current.get(tab) === handle) handles.current.delete(tab);
    };
  }, []);

  const setDirty = useCallback((tab: SettingsTab, dirty: boolean) => {
    setDirtyTabs((current) => {
      if (current.has(tab) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(tab);
      else next.delete(tab);
      return next;
    });
  }, []);

  const show = useCallback(
    (tab: SettingsTab, { scroll = true }: { scroll?: boolean } = {}) => {
      setActive(tab);
      const hash = `#${tab}`;
      if (window.location.hash !== hash) {
        window.history.replaceState(window.history.state, "", hash);
      }
      if (!scroll) return;
      // Bring the new section's top into view when the user had scrolled down.
      requestAnimationFrame(() => {
        const content = contentRef.current;
        if (!content) return;
        const top = content.getBoundingClientRect().top;
        if (top < 0) {
          const offset = window.innerWidth >= 1024 ? 88 : 128;
          window.scrollTo({
            top: window.scrollY + top - offset,
            behavior: reducedMotion ? "auto" : "smooth",
          });
        }
      });
    },
    [reducedMotion]
  );

  const isActiveDirty = useCallback(
    () => handles.current.get(activeRef.current)?.isDirty() ?? false,
    []
  );

  const goTo = useCallback(
    (tab: SettingsTab) => {
      if (tab === activeRef.current) return;
      if (isActiveDirty()) setPending({ tab });
      else show(tab);
    },
    [isActiveDirty, show]
  );

  const proceed = useCallback(
    (target: PendingNavigation) => {
      setPending(null);
      if ("tab" in target) {
        show(target.tab);
      } else {
        allowLeave.current = true;
        router.push(target.href);
      }
    },
    [router, show]
  );

  // Deep link (#branding): pick the section before the first paint after
  // hydration, then hand over from the inline script's CSS to React.
  useIsomorphicLayoutEffect(() => {
    const tab = tabFromHash(window.location.hash);
    if (tab) setActive(tab);
    document.documentElement.removeAttribute(HASH_TAB_ATTRIBUTE);
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const tab = tabFromHash(window.location.hash);
      if (!tab || tab === activeRef.current) return;
      if (isActiveDirty()) {
        window.history.replaceState(window.history.state, "", `#${activeRef.current}`);
        setPending({ tab });
      } else {
        show(tab, { scroll: false });
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [isActiveDirty, show]);

  // Leaving the page with unsaved changes: the browser's prompt for reloads
  // and closing the tab, our dialog for in-app links (nav bar, tab bar).
  useEffect(() => {
    const anyDirty = () => [...handles.current.values()].some((handle) => handle.isDirty());
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeave.current || !anyDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: globalThis.MouseEvent) => {
      if (allowLeave.current || !isActiveDirty()) return;
      const href = leavingHref(event);
      if (!href) return;
      // Capture phase on document: runs before React's (and next/link's) handlers.
      event.preventDefault();
      event.stopPropagation();
      setPending({ href });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [isActiveDirty]);

  // Keep the active tab visible in the phone tab strip.
  useEffect(() => {
    const strip = stripRef.current;
    const item = strip?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!strip || !item || strip.scrollWidth <= strip.clientWidth) return;
    const left = item.offsetLeft - (strip.clientWidth - item.offsetWidth) / 2;
    strip.scrollTo({ left, behavior: reducedMotion ? "auto" : "smooth" });
  }, [active, reducedMotion]);

  const sessionExpired = useCallback(() => {
    allowLeave.current = true;
    reloadForSignIn(tCommon("sessionExpired"));
  }, [tCommon]);

  const context = useMemo<SettingsContextValue>(
    () => ({ data, register, setDirty, goTo, sessionExpired }),
    [data, register, setDirty, goTo, sessionExpired]
  );

  const onNavClick = (event: MouseEvent<HTMLAnchorElement>, tab: SettingsTab) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    goTo(tab);
  };

  const saveAndContinue = async () => {
    const target = pending;
    const handle = handles.current.get(activeRef.current);
    if (!target || !handle) return;
    setSavingFromDialog(true);
    const saved = await handle.save();
    setSavingFromDialog(false);
    if (saved) proceed(target);
    else setPending(null);
  };

  const discardAndContinue = () => {
    const target = pending;
    if (!target) return;
    handles.current.get(activeRef.current)?.discard();
    proceed(target);
  };

  return (
    <SettingsContext.Provider value={context}>
      {data.storeUnavailable ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>{t("storeUnavailable")}</p>
        </div>
      ) : null}

      <div className="mt-4 lg:mt-8 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-10 xl:gap-12">
        <nav
          aria-label={t("sectionsLabel")}
          className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 -mx-4 border-b bg-ground/95 px-4 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-ground/90 md:-mx-6 md:px-6 lg:top-[calc(3.5rem+2rem)] lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        >
          <ul
            ref={stripRef}
            className="no-scrollbar flex gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,transparent,#000_12px,#000_calc(100%-12px),transparent)] lg:flex-col lg:overflow-visible lg:[mask-image:none]"
          >
            {SETTINGS_TABS.map((tab) => {
              const Icon = TAB_ICONS[tab];
              const current = tab === active;
              const dirty = dirtyTabs.has(tab);
              return (
                <li key={tab} data-tab={tab} className="shrink-0 first:pl-1 last:pr-1 lg:p-0 lg:first:pl-0 lg:last:pr-0">
                  <a
                    href={`#${tab}`}
                    aria-current={current ? "true" : undefined}
                    aria-controls={panelId(tab)}
                    onClick={(event) => onNavClick(event, tab)}
                    className={cn(
                      // Inset ring: the scrolling strip would clip an outside one.
                      "group flex h-11 items-center gap-2.5 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:h-10 lg:rounded-lg lg:px-3",
                      current
                        ? "bg-card text-foreground shadow-card ring-1 ring-border"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        current ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span className="lg:flex-1">{t(`tabs.${tab}`)}</span>
                    {dirty ? (
                      <span className="flex items-center">
                        <span aria-hidden="true" className="size-2 rounded-full bg-warning" />
                        <span className="sr-only">{t("unsavedTab")}</span>
                      </span>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div ref={contentRef} className="min-w-0 pt-5 lg:pt-0">
          {SETTINGS_TABS.map((tab) => (
            <div
              key={tab}
              id={panelId(tab)}
              data-settings-panel={tab}
              hidden={tab !== active}
              className="max-w-4xl"
            >
              {tab === "company" ? <CompanySection /> : null}
              {tab === "branding" ? <BrandingSection /> : null}
              {tab === "quotes" ? <QuotesSection /> : null}
              {tab === "payment" ? <PaymentSection /> : null}
              {tab === "email" ? <EmailSection /> : null}
              {tab === "regional" ? <RegionalSection /> : null}
              {tab === "about" ? <AboutSection /> : null}
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && !savingFromDialog && setPending(null)}>
        <AlertDialogContent className="rounded-xl sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("guard.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("guard.description", { section: t(`tabs.${active}`) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-wrap sm:space-x-0">
            <AlertDialogCancel disabled={savingFromDialog} className="mt-0 h-11 sm:mr-auto md:h-9">
              {t("guard.stay")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="ghost"
              onClick={discardAndContinue}
              disabled={savingFromDialog}
              className="h-11 text-destructive hover:bg-destructive/10 hover:text-destructive md:h-9"
            >
              {t("guard.discard")}
            </Button>
            <Button type="button" onClick={saveAndContinue} disabled={savingFromDialog} className="h-11 md:h-9">
              {savingFromDialog ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {t("guard.save")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsContext.Provider>
  );
}
