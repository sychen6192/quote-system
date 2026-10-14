"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { setQuoteStatus } from "@/actions/quote-status";
import { reloadForSignIn } from "@/components/app-shell/session";
import { ACTION_TOAST_DURATION_MS } from "@/components/ui/toast-layer";
import type { QuoteStatus } from "@/lib/status";

/**
 * Saves a status change (quote page and quotes list) and reports it: a toast
 * with Undo when `undo` is given, or the error. Resolves to whether it saved.
 */
export function useSaveQuoteStatus(onNotFound: () => void) {
  const t = useTranslations("QuoteActions");
  const tStatus = useTranslations("Status");
  const tCommon = useTranslations("Common");

  return useCallback(
    async (id: number, next: QuoteStatus, undo?: () => void): Promise<boolean> => {
      let result: Awaited<ReturnType<typeof setQuoteStatus>>;
      try {
        result = await setQuoteStatus(id, next);
      } catch (error) {
        // The proxy answers an expired session with 401, which makes the action throw.
        console.error(error);
        reloadForSignIn(tCommon("sessionExpired"));
        return false;
      }
      if (result.success) {
        toast.success(t("status.changed", { status: tStatus(next) }), {
          id: `quote-status-${id}`,
          action: undo ? { label: t("status.undo"), onClick: undo } : undefined,
          duration: undo ? ACTION_TOAST_DURATION_MS : undefined,
        });
        return true;
      }
      if (result.code === "UNAUTHORIZED") {
        reloadForSignIn(tCommon("sessionExpired"));
      } else if (result.code === "NOT_FOUND") {
        toast.error(t("status.notFound"));
        onNotFound();
      } else {
        toast.error(t("status.failed"));
      }
      return false;
    },
    [onNotFound, t, tCommon, tStatus]
  );
}

/**
 * After a draft's PDF went out (downloaded or shared), offers to mark the
 * quote as sent: sharing a PDF is how most quotes reach the customer, and
 * only emailing from the app marks them sent by itself.
 */
export function useOfferMarkSent() {
  const t = useTranslations("QuoteActions");

  return useCallback(
    (id: number, quotationNumber: string, markSent: () => void) => {
      toast(t("status.sentPrompt", { number: quotationNumber }), {
        id: `quote-sent-prompt-${id}`,
        action: { label: t("status.markSent"), onClick: markSent },
        duration: ACTION_TOAST_DURATION_MS,
      });
    },
    [t]
  );
}
