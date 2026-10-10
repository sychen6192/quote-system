"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { setQuoteStatus } from "@/actions/quote-status";
import { downloadFile } from "@/components/app-shell/download";
import { reloadForSignIn } from "@/components/app-shell/session";
import { DeleteQuoteDialog } from "@/components/delete-quote-button";
import { ACTION_TOAST_DURATION_MS } from "@/components/ui/toast-layer";
import type { AppLocale } from "@/i18n/locales";
import { displayStatus as toDisplayStatus, type DisplayStatus, type QuoteStatus } from "@/lib/status";
import { useRouter } from "@/navigation";
import { SendEmailDialog } from "./send-email-dialog";

export type QuoteDetailInfo = {
  id: number;
  quotationNumber: string;
  title: string | null;
  status: QuoteStatus;
  /** YYYY-MM-DD */
  validUntil: string;
  /** YYYY-MM-DD in the business timezone */
  today: string;
  customerName: string | null;
  customerEmail: string | null;
  /** the sender, for the share text */
  companyName: string;
  mailEnabled: boolean;
  /** APP_PASSWORD is set: only signed-in people can open a shared link */
  authEnabled: boolean;
  locale: AppLocale;
  /** localized PDF file name, e.g. 報價單-QT-20261009-001.pdf */
  pdfFilename: string;
};

type QuoteDetailContextValue = {
  quote: QuoteDetailInfo;
  /** optimistic while a change is in flight */
  status: QuoteStatus;
  displayStatus: DisplayStatus;
  statusPending: boolean;
  changeStatus: (next: QuoteStatus) => void;
  /** /api/quotes/<id>/pdf?download=1&lang=… */
  downloadHref: string;
  openSendDialog: () => void;
  openDeleteDialog: (returnFocus?: RefObject<HTMLElement | null>) => void;
  /** Starts fetching the PDF so a later share() can hand it over within the tap. */
  prepareShare: () => void;
  share: () => Promise<void>;
  print: () => void;
};

const QuoteDetailContext = createContext<QuoteDetailContextValue | null>(null);

export function useQuoteDetail(): QuoteDetailContextValue {
  const value = useContext(QuoteDetailContext);
  if (!value) throw new Error("useQuoteDetail must be used within <QuoteDetailProvider>");
  return value;
}

function canShareFiles(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    typeof File === "function"
  );
}

/**
 * navigator.clipboard only exists in secure contexts; self-hosted installs
 * are often opened over plain http on the LAN, where execCommand still works.
 */
async function copyText(text: string): Promise<void> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  const focused = document.activeElement as HTMLElement | null;
  // Inside the open menu / sheet: its focus trap would pull focus back from the body.
  const host = focused?.closest<HTMLElement>('[role="menu"], [role="dialog"]') ?? document.body;
  host.appendChild(field);
  field.focus({ preventScroll: true });
  field.select();
  try {
    if (!document.execCommand("copy")) throw new Error("copy command refused");
  } finally {
    field.remove();
    focused?.focus?.();
  }
}

/** Shows a "Preparing the PDF…" toast only if the file takes a moment. */
async function withSlowToast<T>(work: Promise<T>, message: string): Promise<T> {
  let toastId: string | number | undefined;
  const timer = window.setTimeout(() => {
    toastId = toast.loading(message);
  }, 400);
  try {
    return await work;
  } finally {
    window.clearTimeout(timer);
    if (toastId !== undefined) toast.dismiss(toastId);
  }
}

const SESSION_EXPIRED = "SessionExpired";

function errorName(error: unknown): string {
  return error instanceof Error || error instanceof DOMException ? error.name : "";
}

export function QuoteDetailProvider({ quote, children }: { quote: QuoteDetailInfo; children: ReactNode }) {
  const t = useTranslations("QuoteActions");
  const tStatus = useTranslations("Status");
  const tCommon = useTranslations("Common");
  const router = useRouter();

  const [status, setOptimisticStatus] = useOptimistic(quote.status);
  const [statusPending, startStatusTransition] = useTransition();
  const [sendOpen, setSendOpen] = useState(false);
  // Remounts the dialog on every open: a fresh form with the current customer email.
  const [sendKey, setSendKey] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteReturnFocus = useRef<HTMLElement | null>(null);
  const pdfFile = useRef<Promise<File> | null>(null);

  // The toast's Undo runs after a re-render: it must call the latest version.
  const changeStatusRef = useRef<(next: QuoteStatus, undoable?: boolean) => void>(() => {});
  const changeStatus = useCallback(
    (next: QuoteStatus, undoable = true) => {
      const previous = status;
      if (next === previous) return;
      startStatusTransition(async () => {
        setOptimisticStatus(next);
        let result: Awaited<ReturnType<typeof setQuoteStatus>>;
        try {
          result = await setQuoteStatus(quote.id, next);
        } catch (error) {
          // The proxy answers an expired session with 401, which makes the action throw.
          console.error(error);
          reloadForSignIn(tCommon("sessionExpired"));
          return;
        }
        if (result.success) {
          toast.success(t("status.changed", { status: tStatus(next) }), {
            id: `quote-status-${quote.id}`,
            action: undoable
              ? { label: t("status.undo"), onClick: () => changeStatusRef.current(previous, false) }
              : undefined,
            duration: undoable ? ACTION_TOAST_DURATION_MS : undefined,
          });
        } else if (result.code === "UNAUTHORIZED") {
          reloadForSignIn(tCommon("sessionExpired"));
        } else if (result.code === "NOT_FOUND") {
          toast.error(t("status.notFound"));
          router.push("/quotes");
        } else {
          toast.error(t("status.failed"));
        }
      });
    },
    [quote.id, router, setOptimisticStatus, status, t, tCommon, tStatus]
  );
  useEffect(() => {
    changeStatusRef.current = changeStatus;
  }, [changeStatus]);

  const pdfUrl = `/api/quotes/${quote.id}/pdf?lang=${encodeURIComponent(quote.locale)}`;

  const loadPdfFile = useCallback(() => {
    pdfFile.current ??= (async () => {
      const saved: { file?: File } = {};
      const outcome = await downloadFile(pdfUrl, {
        fetch: (input, init) => window.fetch(input, init),
        save: (blob) => {
          saved.file = new File([blob], quote.pdfFilename, { type: "application/pdf" });
        },
      });
      if (outcome === "unauthorized") {
        const error = new Error("The session has expired");
        error.name = SESSION_EXPIRED;
        throw error;
      }
      if (!saved.file) throw new Error("PDF request failed");
      return saved.file;
    })().catch((error: unknown) => {
      pdfFile.current = null;
      throw error;
    });
    return pdfFile.current;
  }, [pdfUrl, quote.pdfFilename]);

  const prepareShare = useCallback(() => {
    if (canShareFiles()) loadPdfFile().catch(() => {});
  }, [loadPdfFile]);

  const copyLink = useCallback(async () => {
    const url = window.location.href.split("#")[0];
    try {
      await copyText(url);
      toast.success(t("shareSheet.copied"), {
        description: t(quote.authEnabled ? "shareSheet.copiedHint" : "shareSheet.copiedHintOpen"),
      });
    } catch {
      // Nothing on this page to select: show the link so it can be copied by hand.
      toast.error(tCommon("copyFailed"), { description: url, duration: 10_000 });
    }
  }, [quote.authEnabled, t, tCommon]);

  const share = useCallback(
    async function shareQuote(): Promise<void> {
      if (canShareFiles()) {
        let file: File | null = null;
        try {
          file = await withSlowToast(loadPdfFile(), t("shareSheet.preparing"));
        } catch (error) {
          if (errorName(error) === SESSION_EXPIRED) {
            reloadForSignIn(tCommon("sessionExpired"));
            return;
          }
          console.error(error);
        }
        if (file && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: t("shareSheet.title", { number: quote.quotationNumber }),
              text: t("shareSheet.text", { number: quote.quotationNumber, company: quote.companyName }),
            });
            return;
          } catch (error) {
            const name = errorName(error);
            if (name === "AbortError") return;
            // Waiting for the PDF used up the tap's user activation (Safari):
            // the file is ready now, so a second tap shares straight away.
            if (name === "NotAllowedError") {
              toast(t("shareSheet.title", { number: quote.quotationNumber }), {
                action: { label: t("share"), onClick: () => void shareQuote() },
                duration: ACTION_TOAST_DURATION_MS,
              });
              return;
            }
            console.error(error);
          }
        }
      }
      await copyLink();
    },
    [copyLink, loadPdfFile, quote.companyName, quote.quotationNumber, t, tCommon]
  );

  const value = useMemo<QuoteDetailContextValue>(
    () => ({
      quote,
      status,
      displayStatus: toDisplayStatus(status, quote.validUntil, quote.today),
      statusPending,
      changeStatus: (next) => changeStatus(next),
      downloadHref: `${pdfUrl}&download=1`,
      openSendDialog: () => {
        setSendKey((key) => key + 1);
        setSendOpen(true);
      },
      openDeleteDialog: (returnFocus) => {
        deleteReturnFocus.current = returnFocus?.current ?? null;
        setDeleteOpen(true);
      },
      prepareShare,
      share,
      print: () => window.print(),
    }),
    [changeStatus, pdfUrl, prepareShare, quote, share, status, statusPending]
  );

  return (
    <QuoteDetailContext.Provider value={value}>
      {children}
      <SendEmailDialog key={sendKey} open={sendOpen} onOpenChange={setSendOpen} />
      <DeleteQuoteDialog
        id={quote.id}
        quotationNumber={quote.quotationNumber}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        redirectTo="/quotes"
        returnFocusRef={deleteReturnFocus}
      />
    </QuoteDetailContext.Provider>
  );
}
