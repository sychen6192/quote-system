"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import dynamic from "next/dynamic";
import { useForm, useFormState, useWatch, type FieldErrors, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Building2,
  ChevronLeft,
  Eye,
  FileText,
  ListOrdered,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Receipt,
  Save,
  ScrollText,
  X,
} from "lucide-react";
import { createQuote } from "@/actions/create-quote";
import type { ActionFailure, ActionResult } from "@/actions/types";
import { updateQuote } from "@/actions/update-quote";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/quotes/quote-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { KbdHotkey } from "@/components/ui/kbd";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHandle,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFormDraft, draftDiffers, type DraftStatusStore } from "@/hooks/use-form-draft";
import { useHotkey } from "@/hooks/use-hotkey";
import { useIsDesktop, usePrefersReducedMotion } from "@/hooks/use-media-query";
import { isIsoDate } from "@/lib/dates";
import {
  quoteFormSchema,
  type QuoteFormData,
  type QuoteFormValues,
} from "@/lib/schemas/quote";
import type { DocumentBranding } from "@/lib/settings/types";
import { displayStatus, type QuoteStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import { useRouter } from "@/navigation";
import { AutosaveIndicator } from "./autosave-indicator";
import {
  CustomerPrefilledBanner,
  DraftRestoreBanner,
  DuplicatedBanner,
  StatusNoticeBanner,
} from "./banners";
import { CustomerSection } from "./customer-section";
import { DetailsSection } from "./details-section";
import { EditorProvider, createRevealBus, useMoney, type EditorContextValue } from "./editor-context";
import { WrappingMoney } from "./field-bits";
import {
  SECTION_IDS,
  collectErrorPaths,
  mapServerFieldErrors,
  previewFieldToFormPath,
  sectionDomId,
  sectionForPath,
  type SectionId,
} from "./form-model";
import { ItemsSection } from "./items-section";
import type { QuotePreviewProps } from "./quote-preview";
import { SectionCard } from "./section-card";
import { SectionIndex } from "./section-index";
import { TermsSection } from "./terms-section";
import { TotalsSection, useFormTotals } from "./totals-section";

const QuotePreview = dynamic(() => import("./quote-preview"), {
  ssr: false,
  loading: () => <PaperSkeleton />,
});

export type QuoteFormProps = {
  mode: "create" | "edit";
  /** edit: the quote being edited */
  quoteId?: number | null;
  quotationNumber?: string | null;
  status?: QuoteStatus;
  initialValues: QuoteFormValues;
  /** localStorage key for the autosaved draft (quoteDraftKey) */
  draftKey: string;
  /** edit: drafts of older versions of this quote to delete (quoteDraftPrefix) */
  draftPrunePrefix?: string;
  /** YYYY-MM-DD in the business timezone */
  today: string;
  /** getDocumentBranding("html") for the live preview */
  branding: DocumentBranding;
  /** ?from=<id> */
  duplicatedFrom?: { id: number; quotationNumber: string } | null;
  /** ?customer=<name> matched a saved customer */
  prefilledCustomer?: string | null;
};

const ALL_OPEN: Record<SectionId, boolean> = {
  customer: true,
  details: true,
  items: true,
  totals: true,
  terms: true,
};

const SECTION_ICONS = {
  customer: Building2,
  details: FileText,
  items: ListOrdered,
  totals: Receipt,
  terms: ScrollText,
} as const;

// "Hide preview" is remembered per browser. External store so the server
// render and hydration agree (shown), with no setState-in-effect.
const PREVIEW_HIDDEN_KEY = "qs:quote-form:preview-hidden";
const previewListeners = new Set<() => void>();
let previewHiddenFallback = false;

function readPreviewHidden(): boolean {
  try {
    const stored = window.localStorage.getItem(PREVIEW_HIDDEN_KEY);
    return stored === null ? previewHiddenFallback : stored === "1";
  } catch {
    return previewHiddenFallback;
  }
}

function writePreviewHidden(hidden: boolean) {
  previewHiddenFallback = hidden;
  try {
    window.localStorage.setItem(PREVIEW_HIDDEN_KEY, hidden ? "1" : "0");
  } catch {
    // The in-memory fallback keeps working for this page view.
  }
  previewListeners.forEach((listener) => listener());
}

function subscribePreviewHidden(listener: () => void) {
  previewListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PREVIEW_HIDDEN_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    previewListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function usePreviewHidden(): boolean {
  return useSyncExternalStore(subscribePreviewHidden, readPreviewHidden, () => false);
}

export function QuoteForm({
  mode,
  quoteId = null,
  quotationNumber = null,
  status = "draft",
  initialValues,
  draftKey,
  draftPrunePrefix,
  today,
  branding,
  duplicatedFrom = null,
  prefilledCustomer = null,
}: QuoteFormProps) {
  const t = useTranslations("QuoteForm");
  const tv = useTranslations("Validation");
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const reducedMotion = usePrefersReducedMotion();
  const previewHidden = usePreviewHidden();
  const formId = useId();
  const titleId = `${formId}-title`;

  const [defaults] = useState(() => initialValues);
  const form = useForm<QuoteFormValues, unknown, QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    mode: "onTouched",
    defaultValues: defaults,
    // We focus the first error ourselves, after expanding its section.
    shouldFocusError: false,
  });

  const formRef = useRef<HTMLFormElement>(null);
  const bannersRef = useRef<HTMLDivElement>(null);
  const cancelReturnFocus = useRef<HTMLElement | null>(null);
  const allowLeave = useRef(false);
  const savingRef = useRef(false);
  const sheetFocus = useRef<string | null>(null);
  const [reveal] = useState(createRevealBus);
  const [openSections, setOpenSections] = useState(ALL_OPEN);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [bodyKey, setBodyKey] = useState(0);
  const [saved, setSaved] = useState(false);

  const subscribe = useCallback(
    (onChange: (values: QuoteFormValues) => void) =>
      form.subscribe({
        formState: { values: true },
        callback: ({ values }) => onChange(values as QuoteFormValues),
      }),
    [form]
  );
  const draft = useFormDraft<QuoteFormValues>({
    key: draftKey,
    subscribe,
    initialValues: defaults,
    prunePrefix: draftPrunePrefix,
  });

  // A reload restores the scroll position, which can leave the restore
  // prompt above the fold (and the user typing into stale values).
  const offerRestore = draft.restorable !== null;
  useEffect(() => {
    if (!offerRestore) return;
    const banners = bannersRef.current;
    if (banners && banners.getBoundingClientRect().top < 0) window.scrollTo({ top: 0 });
  }, [offerRestore]);

  const leaveTo = mode === "edit" && quoteId ? `/quotes/${quoteId}` : "/quotes";
  const isDirty = useCallback(() => draftDiffers(form.getValues(), defaults), [form, defaults]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeave.current || !isDirty()) return;
      event.preventDefault();
      // Legacy browsers need returnValue set to show the prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const flushDraft = draft.flush;
  const onSessionExpired = useCallback(() => {
    flushDraft();
    allowLeave.current = true;
    toast.error(t("messages.sessionExpired"), { id: "quote-form-session" });
    window.setTimeout(() => window.location.reload(), 1200);
  }, [flushDraft, t]);

  const editor = useMemo<EditorContextValue>(
    () => ({ today, reveal, onSessionExpired }),
    [today, reveal, onSessionExpired]
  );

  const scrollBehavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

  const openSectionsFor = useCallback((paths: readonly string[]) => {
    const ids = new Set(paths.map(sectionForPath).filter((id): id is SectionId => id !== null));
    if (!ids.size) return;
    setOpenSections((current) =>
      [...ids].every((id) => current[id])
        ? current
        : { ...current, ...Object.fromEntries([...ids].map((id) => [id, true])) }
    );
  }, []);

  /** After React has committed (sections opened, fields revealed). */
  const afterCommit = (run: () => void) =>
    requestAnimationFrame(() => requestAnimationFrame(run));

  const focusPath = useCallback(
    (path: string) => {
      openSectionsFor([path]);
      reveal.emit(path);
      afterCommit(() => {
        const root = formRef.current;
        const target = root?.querySelector<HTMLElement>(
          `[name="${CSS.escape(path)}"]:not([type="hidden"])`
        );
        if (target) {
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "center", behavior: scrollBehavior });
          if (target instanceof HTMLInputElement && target.type !== "date") target.select();
          return;
        }
        try {
          form.setFocus(path as FieldPath<QuoteFormValues>);
        } catch {
          // Not focusable (e.g. not mounted); the section is open at least.
        }
      });
    },
    [form, openSectionsFor, reveal, scrollBehavior]
  );

  const focusFirstError = useCallback(
    (paths: readonly string[]) => {
      openSectionsFor(paths);
      paths.forEach((path) => reveal.emit(path));
      afterCommit(() => {
        const root = formRef.current;
        const field = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
        const target = field ?? root?.querySelector<HTMLElement>("[data-form-error]");
        if (!target) return;
        target.scrollIntoView({ block: "center", behavior: scrollBehavior });
        field?.focus({ preventScroll: true });
      });
    },
    [openSectionsFor, reveal, scrollBehavior]
  );

  const onEditField = useCallback(
    (field: string) => {
      const path = previewFieldToFormPath(field);
      if (!path) return;
      if (sheetOpen) {
        // Close the sheet first; focus after its own focus restore.
        sheetFocus.current = path;
        setSheetOpen(false);
        return;
      }
      focusPath(path);
    },
    [focusPath, sheetOpen]
  );

  const goToSection = (id: SectionId) => {
    setOpenSections((current) => (current[id] ? current : { ...current, [id]: true }));
    afterCommit(() => {
      const section = document.getElementById(sectionDomId(id));
      section?.scrollIntoView({ block: "start", behavior: scrollBehavior });
      section?.focus({ preventScroll: true });
    });
  };

  const applyServerErrors = (failure: Extract<ActionFailure, { code: "VALIDATION" }>) => {
    const { fields, form: formLevel } = mapServerFieldErrors(failure.fieldErrors);
    fields.forEach(({ path, message }) =>
      form.setError(path as FieldPath<QuoteFormValues>, { type: "server", message })
    );
    const description = formLevel.length
      ? formLevel.map((key) => (tv.has(key) ? tv(key) : key)).join(" ")
      : t("messages.invalidHint");
    toast.error(t("messages.invalid", { count: Math.max(fields.length, 1) }), {
      id: "quote-form-invalid",
      description,
    });
    focusFirstError(fields.map((f) => f.path));
  };

  const onOffline = () => {
    draft.flush();
    toast.error(t("messages.offline"), { id: "quote-form-offline" });
  };

  const onValid = async (data: QuoteFormData) => {
    if (savingRef.current) return;
    if (isOffline()) return onOffline();
    savingRef.current = true;
    let result: ActionResult;
    try {
      result =
        mode === "edit" && quoteId !== null
          ? await updateQuote(quoteId, data)
          : await createQuote(data);
    } catch {
      savingRef.current = false;
      if (isOffline()) onOffline();
      else onSessionExpired();
      return;
    }
    if (result.success) {
      draft.clear();
      allowLeave.current = true;
      setSaved(true);
      toast.success(mode === "edit" ? t("messages.updated") : t("messages.created"));
      const id = result.id ?? quoteId;
      router.push(id ? `/quotes/${id}` : "/quotes");
      router.refresh();
      return;
    }
    savingRef.current = false;
    switch (result.code) {
      case "VALIDATION":
        applyServerErrors(result);
        return;
      case "UNAUTHORIZED":
        onSessionExpired();
        return;
      case "NOT_FOUND":
        toast.error(t("messages.notFound"));
        return;
      case "RATE_LIMITED":
        toast.error(t("messages.rateLimited"));
        return;
      default:
        toast.error(t("messages.error"), {
          action: { label: t("messages.retry"), onClick: () => formRef.current?.requestSubmit() },
        });
    }
  };

  const onInvalid = (errors: FieldErrors<QuoteFormValues>) => {
    const paths = collectErrorPaths(errors);
    toast.error(t("messages.invalid", { count: Math.max(paths.length, 1) }), {
      id: "quote-form-invalid",
      description: t("messages.invalidHint"),
    });
    focusFirstError(paths);
  };

  const submit = (event: FormEvent<HTMLFormElement>) =>
    form.handleSubmit(onValid, onInvalid)(event);

  useHotkey("mod+s", () => {
    if (!savingRef.current && !saved) formRef.current?.requestSubmit();
  });

  // Enter in a single-line input must not submit the whole quote; Save and
  // Ctrl/⌘+S do. Widgets that use Enter (combobox, price → next row) handle
  // it first and call preventDefault.
  const onFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || event.defaultPrevented || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && !["submit", "button", "checkbox", "radio"].includes(target.type)) {
      event.preventDefault();
    }
  };

  const requestCancel = () => {
    if (!isDirty()) return router.push(leaveTo);
    // The dialog has no trigger, so Radix can't restore focus by itself.
    cancelReturnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmLeave(true);
  };

  const discardAndLeave = () => {
    draft.clear();
    allowLeave.current = true;
    router.push(leaveTo);
  };

  const restoreDraft = () => {
    const values = draft.restore();
    if (!values) return;
    form.reset(values, { keepDefaultValues: true });
    // Remount the sections so local UI state (description / discount
    // toggles) is re-derived from the restored values.
    setBodyKey((key) => key + 1);
    toast.success(t("banners.restored"));
  };

  // The saved quote's state (not the live form): what the customer has seen.
  const savedStatus = mode === "edit" ? displayStatus(status, defaults.validUntil, today) : null;

  const showStatusNotice =
    savedStatus === "sent" || savedStatus === "accepted" || savedStatus === "expired";

  const showPane = !previewHidden;
  const previewProps: Omit<QuotePreviewProps, "fit" | "className"> = {
    today,
    quoteId,
    quotationNumber,
    status,
    branding,
    onEditField,
  };

  const backLabel = mode === "edit" && quotationNumber ? quotationNumber : t("header.back");
  const title =
    mode === "edit" && quotationNumber
      ? t("header.editTitle", { number: quotationNumber })
      : t("header.createTitle");

  return (
    <EditorProvider value={editor}>
      <Form {...form}>
        <div
          className={cn(
            "mx-auto w-full px-4 pb-28 pt-4 md:px-6 md:pb-0 md:pt-6 xl:px-8",
            showPane ? "max-w-[1680px]" : "max-w-[60rem]"
          )}
        >
          <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={requestCancel}
                aria-label={t("header.backTo", { target: backLabel })}
                className="-ml-1.5 inline-flex min-h-11 items-center gap-1 rounded-md px-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                {backLabel}
              </button>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1
                  id={titleId}
                  className="min-w-0 break-words text-2xl font-bold tracking-tight text-foreground md:text-3xl"
                >
                  {title}
                </h1>
                {savedStatus && (
                  // The badge tints are tuned for 4.5:1 over the card colour,
                  // not over the darker page ground.
                  <span className="rounded-full bg-card">
                    <StatusBadge status={savedStatus} size="md" />
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "edit" ? t("header.editDesc") : t("header.createDesc")}
              </p>
            </div>
            <div className="flex items-center gap-3 md:pb-1">
              <AutosaveIndicator store={draft.statusStore} className="md:hidden" />
              <Button
                type="button"
                variant="outline"
                onClick={() => writePreviewHidden(!previewHidden)}
                aria-pressed={!previewHidden}
                className="hidden bg-card xl:inline-flex"
              >
                {previewHidden ? (
                  <PanelRightOpen aria-hidden="true" />
                ) : (
                  <PanelRightClose aria-hidden="true" />
                )}
                {previewHidden ? t("preview.show") : t("preview.hide")}
              </Button>
            </div>
          </header>

          {(draft.restorable || duplicatedFrom || prefilledCustomer || showStatusNotice) && (
            <div ref={bannersRef} className="mt-4 space-y-3">
              {draft.restorable && (
                <DraftRestoreBanner
                  savedAt={draft.restorable.savedAt}
                  onRestore={restoreDraft}
                  onDiscard={() => {
                    draft.discard();
                    toast(t("banners.discarded"));
                  }}
                />
              )}
              {duplicatedFrom && (
                <DuplicatedBanner
                  id={duplicatedFrom.id}
                  quotationNumber={duplicatedFrom.quotationNumber}
                />
              )}
              {prefilledCustomer && !duplicatedFrom && (
                <CustomerPrefilledBanner company={prefilledCustomer} />
              )}
              {showStatusNotice && quoteId !== null && savedStatus && (
                <StatusNoticeBanner
                  quoteId={quoteId}
                  status={savedStatus}
                  validUntil={String(defaults.validUntil ?? "")}
                  onSetValidity={() => focusPath("validUntil")}
                />
              )}
            </div>
          )}

          <div
            className={cn(
              "mt-5 grid gap-6 md:mt-6 xl:gap-8",
              showPane && "xl:grid-cols-[minmax(0,1fr)_minmax(0,40%)]"
            )}
          >
            <form
              ref={formRef}
              id={formId}
              noValidate
              aria-labelledby={titleId}
              onSubmit={submit}
              onKeyDown={onFormKeyDown}
              className="min-w-0"
            >
              <SectionIndex onNavigate={goToSection} />
              <div key={bodyKey} className="space-y-4 md:mt-4 md:space-y-5">
                {SECTION_IDS.map((id) => (
                  <SectionCard
                    key={id}
                    id={id}
                    icon={SECTION_ICONS[id]}
                    title={t(`sections.${id}`)}
                    description={t(`sections.${id}Desc`)}
                    open={openSections[id]}
                    onOpenChange={(open) =>
                      setOpenSections((current) => ({ ...current, [id]: open }))
                    }
                    summary={<SectionSummary id={id} />}
                  >
                    {id === "customer" ? (
                      <CustomerSection />
                    ) : id === "details" ? (
                      <DetailsSection />
                    ) : id === "items" ? (
                      <ItemsSection />
                    ) : id === "totals" ? (
                      <TotalsSection />
                    ) : (
                      <TermsSection />
                    )}
                  </SectionCard>
                ))}
              </div>
            </form>

            {showPane && (
              <PreviewPane mounted={isDesktop} onHide={() => writePreviewHidden(true)} {...previewProps} />
            )}
          </div>

          <ActionBar
            formId={formId}
            store={draft.statusStore}
            saved={saved}
            mode={mode}
            showPreviewButton={!isDesktop}
            onPreview={() => setSheetOpen(true)}
            onCancel={requestCancel}
          />
        </div>

        {!isDesktop && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent
              side="bottom"
              showCloseButton={false}
              className="flex h-[92dvh] flex-col gap-0 bg-ground p-0"
              onCloseAutoFocus={(event) => {
                const path = sheetFocus.current;
                if (!path) return;
                sheetFocus.current = null;
                event.preventDefault();
                focusPath(path);
              }}
            >
              <PreviewSheetBody {...previewProps} />
            </SheetContent>
          </Sheet>
        )}

        <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
          <AlertDialogContent
            onCloseAutoFocus={(event) => {
              const target = cancelReturnFocus.current;
              cancelReturnFocus.current = null;
              if (!target?.isConnected) return;
              event.preventDefault();
              target.focus();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{t("cancelDialog.title")}</AlertDialogTitle>
              <AlertDialogDescription>{t("cancelDialog.description")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel className="h-11 sm:h-9">{t("cancelDialog.keep")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={discardAndLeave}
                className={cn(buttonVariants({ variant: "destructive" }), "h-11 sm:h-9")}
              >
                {t("cancelDialog.discard")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Form>
    </EditorProvider>
  );
}

function ZoomToggle({ fit, onChange }: { fit: boolean; onChange: (fit: boolean) => void }) {
  const t = useTranslations("QuoteForm.preview");
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={fit ? "fit" : "actual"}
      onValueChange={(value) => value && onChange(value === "fit")}
      aria-label={t("zoom")}
      className="gap-0"
    >
      <ToggleGroupItem value="fit" className="h-9 rounded-r-none px-2.5 text-xs md:h-8">
        {t("fit")}
      </ToggleGroupItem>
      <ToggleGroupItem value="actual" className="-ml-px h-9 rounded-l-none px-2.5 text-xs tabular-nums md:h-8">
        {t("actualSize")}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** Rendered inside SheetContent, so it (and the preview) mounts only while open. */
function PreviewSheetBody(props: Omit<QuotePreviewProps, "fit" | "className">) {
  const t = useTranslations("QuoteForm.preview");
  const tUi = useTranslations("UI");
  const [fit, setFit] = useState(true);
  return (
    <>
      <div className="relative flex items-center gap-2 rounded-t-2xl border-b bg-background px-4 pb-3 pt-5">
        <SheetHandle className="absolute left-1/2 top-2 mt-0 -translate-x-1/2" />
        <div className="min-w-0 flex-1">
          <SheetTitle className="text-base">{t("title")}</SheetTitle>
          <SheetDescription className="truncate text-xs">{t("clickToEdit")}</SheetDescription>
        </div>
        <ZoomToggle fit={fit} onChange={setFit} />
        <SheetClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label={tUi("close")}
          >
            <X aria-hidden="true" />
          </Button>
        </SheetClose>
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-ground">
        <QuotePreview fit={fit} {...props} />
      </div>
    </>
  );
}

function PreviewPane({
  mounted,
  onHide,
  ...props
}: Omit<QuotePreviewProps, "fit" | "className"> & { mounted: boolean; onHide: () => void }) {
  const t = useTranslations("QuoteForm.preview");
  const [fit, setFit] = useState(true);
  return (
    <aside
      aria-labelledby="quote-preview-title"
      className="sticky top-[calc(4.25rem+env(safe-area-inset-top,0px))] hidden h-[calc(100dvh-10.75rem-env(safe-area-inset-top,0px))] min-h-[26rem] flex-col self-start overflow-hidden rounded-xl border bg-ground shadow-card xl:flex print:hidden"
    >
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
        <Eye aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="quote-preview-title" className="text-sm font-semibold">
          {t("live")}
        </h2>
        <p className="hidden min-w-0 truncate text-xs text-muted-foreground 2xl:block">
          · {t("clickToEdit")}
        </p>
        <div className="ml-auto flex items-center gap-1">
          <ZoomToggle fit={fit} onChange={setFit} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onHide}
            aria-label={t("hide")}
            className="size-8 text-muted-foreground"
          >
            <PanelRightClose aria-hidden="true" />
          </Button>
        </div>
      </div>
      {mounted ? <QuotePreview fit={fit} {...props} /> : <PaperSkeleton />}
    </aside>
  );
}

function PaperSkeleton() {
  const t = useTranslations("QuoteForm.preview");
  return (
    <div className="min-h-0 flex-1 overflow-hidden p-4 md:p-6" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <div className="mx-auto aspect-[210/297] w-full max-w-[210mm] space-y-4 rounded-sm bg-paper p-[6%] shadow-elevated ring-1 ring-black/5">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-1/4 bg-black/10" />
          <Skeleton className="h-8 w-1/3 bg-black/10" />
        </div>
        <Skeleton className="h-1 w-full bg-black/10" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-20 bg-black/5" />
          <Skeleton className="h-20 bg-black/5" />
        </div>
        <Skeleton className="h-40 bg-black/5" />
        <Skeleton className="ml-auto h-16 w-1/2 bg-black/5" />
      </div>
    </div>
  );
}

function TotalFigure({ className }: { className?: string }) {
  const money = useMoney();
  const totals = useFormTotals();
  return <span className={cn("money", className)}>{money.format(totals.total)}</span>;
}

/** Shrinks for long figures instead of truncating money next to the buttons. */
function PhoneTotal() {
  const money = useMoney();
  const text = money.format(useFormTotals().total);
  const size =
    text.length > 16
      ? "text-[0.8125rem]"
      : text.length > 14
        ? "text-sm"
        : text.length > 11
          ? "text-base"
          : "text-lg";
  return (
    <WrappingMoney value={text} className={cn("block font-bold leading-tight text-foreground", size)} />
  );
}

function ActionBar({
  formId,
  store,
  saved,
  mode,
  showPreviewButton,
  onPreview,
  onCancel,
}: {
  formId: string;
  store: DraftStatusStore;
  saved: boolean;
  mode: "create" | "edit";
  showPreviewButton: boolean;
  onPreview: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("QuoteForm");
  // Own subscription: only the bar re-renders while submitting.
  const { isSubmitting } = useFormState<QuoteFormValues>();
  const busy = isSubmitting || saved;
  const saveLabel = mode === "edit" ? t("actions.update") : t("actions.save");

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 pb-safe-3 shadow-[0_-4px_16px_-8px_hsl(var(--shadow-color)/0.12)] backdrop-blur supports-[backdrop-filter]:bg-background/90 md:sticky md:-mx-6 md:mt-6 md:px-6 md:py-3 xl:-mx-8 xl:px-8 print:hidden">
      {/* Phones: total + Preview + Save */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{t("actions.total")}</p>
          <PhoneTotal />
        </div>
        <Button type="button" variant="outline" onClick={onPreview} className="h-11 px-3">
          <Eye aria-hidden="true" />
          {t("actions.preview")}
        </Button>
        <Button type="submit" form={formId} disabled={busy} className="h-11 px-4 font-semibold">
          {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
          {busy ? t("actions.saving") : t("actions.saveShort")}
        </Button>
      </div>

      {/* Tablet / desktop */}
      <div className="hidden items-center gap-3 md:flex">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-muted-foreground">
          {t("actions.cancel")}
        </Button>
        <AutosaveIndicator store={store} />
        <div className="ml-auto flex items-center gap-3">
          <p className="flex items-baseline gap-2 text-sm text-muted-foreground">
            {t("actions.total")}
            <TotalFigure className="text-lg font-bold text-foreground" />
          </p>
          {showPreviewButton && (
            <Button type="button" variant="outline" onClick={onPreview}>
              <Eye aria-hidden="true" />
              {t("actions.preview")}
            </Button>
          )}
          <Button
            type="submit"
            form={formId}
            disabled={busy}
            aria-keyshortcuts="Control+S Meta+S"
            className="min-w-36 font-semibold"
          >
            {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
            {busy ? t("actions.saving") : saveLabel}
            {!busy && (
              <KbdHotkey
                hotkey="mod+s"
                aria-hidden="true"
                className="ml-1 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground"
              />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** One-line recap of a collapsed section (each watches only what it shows). */
function SectionSummary({ id }: { id: SectionId }) {
  switch (id) {
    case "customer":
      return <CustomerSummary />;
    case "details":
      return <DetailsSummary />;
    case "items":
      return <ItemsSummary />;
    case "totals":
      return <TotalsSummary />;
    case "terms":
      return <TermsSummary />;
  }
}

function useSummaryText(names: readonly FieldPath<QuoteFormValues>[]): string[] {
  const values = useWatch<QuoteFormValues>({ name: [...names] }) as unknown[];
  return values.map((value) => (typeof value === "string" ? value.trim() : ""));
}

function CustomerSummary() {
  const t = useTranslations("QuoteForm.sections");
  const parts = useSummaryText(["companyName", "contactPerson"]).filter(Boolean);
  return <>{parts.join(" · ") || t("summaryEmpty")}</>;
}

function DetailsSummary() {
  const t = useTranslations("QuoteForm");
  const [validUntil] = useSummaryText(["validUntil"]);
  return <>{isIsoDate(validUntil) ? `${t("fields.validUntil")} ${validUntil}` : t("sections.summaryEmpty")}</>;
}

function ItemsSummary() {
  const t = useTranslations("QuoteForm.items");
  const count = useWatch<QuoteFormValues, "items", QuoteFormValues, number>({
    name: "items",
    compute: (items) => (Array.isArray(items) ? items.length : 0),
  });
  return <>{t("count", { count })}</>;
}

function TotalsSummary() {
  const t = useTranslations("QuoteForm.actions");
  return (
    <>
      {t("total")} <TotalFigure />
    </>
  );
}

function TermsSummary() {
  const t = useTranslations("QuoteForm.sections");
  const [payment] = useSummaryText(["paymentMethod"]);
  return <>{payment || t("summaryEmpty")}</>;
}
