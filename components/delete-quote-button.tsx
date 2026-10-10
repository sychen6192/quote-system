"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/navigation";
import { deleteQuote } from "@/actions/delete-quote";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { reloadForSignIn } from "@/components/app-shell/session";
import { cn } from "@/lib/utils";

export type DeleteQuoteDialogProps = {
  id: number;
  quotationNumber: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Where to go after deleting. Default: stay and refresh the current page,
   * except on the deleted quote's own detail/edit page, which goes to /quotes.
   */
  redirectTo?: string;
  /** Rendered as the dialog trigger (uncontrolled use). */
  trigger?: ReactNode;
  /**
   * Where focus goes when the dialog closes. Needed when it was opened from a
   * menu item, which no longer exists by then.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

/** Confirmation dialog that deletes a quote (controlled, or with a `trigger`). */
export function DeleteQuoteDialog({
  id,
  quotationNumber,
  open: openProp,
  onOpenChange,
  redirectTo,
  trigger,
  returnFocusRef,
}: DeleteQuoteDialogProps) {
  const t = useTranslations("QuotesList.delete");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const pathname = usePathname();
  const [openState, setOpenState] = useState(false);
  const [pending, setPending] = useState(false);
  const open = openProp ?? openState;

  const setOpen = (next: boolean) => {
    if (pending && !next) return;
    setOpenState(next);
    onOpenChange?.(next);
  };

  const leave = () => {
    const onOwnPage = new RegExp(`^/quotes/${id}(/edit)?/?$`).test(pathname);
    const target = redirectTo ?? (onOwnPage ? "/quotes" : null);
    // Refreshing as well would re-render the deleted quote's page (a 404) first.
    if (target) router.push(target);
    else router.refresh();
  };

  const confirm = async () => {
    setPending(true);
    let result: Awaited<ReturnType<typeof deleteQuote>>;
    try {
      result = await deleteQuote(id);
    } catch (error) {
      // The proxy answers an expired session with 401, which makes the action throw.
      console.error(error);
      setPending(false);
      reloadForSignIn(tCommon("sessionExpired"));
      return;
    }
    setPending(false);

    if (result.success) {
      toast.success(t("deleted", { number: quotationNumber }));
    } else if (result.code === "UNAUTHORIZED") {
      reloadForSignIn(tCommon("sessionExpired"));
      return;
    } else if (result.code === "NOT_FOUND") {
      toast.info(t("notFound"));
    } else {
      toast.error(t("error"));
      return;
    }
    setOpenState(false);
    onOpenChange?.(false);
    leave();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent
        className="rounded-xl sm:max-w-md"
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef?.current?.isConnected) return;
          event.preventDefault();
          returnFocusRef.current.focus();
        }}
      >
        <AlertDialogHeader>
          <div
            aria-hidden="true"
            className="mx-auto mb-1 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0"
          >
            <Trash2 className="size-5" />
          </div>
          <AlertDialogTitle className="break-words">
            {t("title", { number: quotationNumber })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={pending} className="h-11 sm:h-9">
            {tCommon("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
            disabled={pending}
            className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:h-9"
          >
            {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            {pending ? t("deleting") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface Props {
  id: number;
  quotationNumber: string;
  variant?: "icon" | "button";
  /** See DeleteQuoteDialogProps.redirectTo */
  redirectTo?: string;
  className?: string;
}

/** A delete button (icon or outlined) with its confirmation dialog. */
export function DeleteQuoteButton({
  id,
  quotationNumber,
  variant = "icon",
  redirectTo,
  className,
}: Props) {
  const t = useTranslations("QuotesList.delete");
  const trigger =
    variant === "icon" ? (
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("trigger")}
        title={t("trigger")}
        className={cn("text-muted-foreground hover:bg-destructive/10 hover:text-destructive", className)}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    ) : (
      <Button
        variant="outline"
        size="sm"
        className={cn("text-destructive hover:bg-destructive/10 hover:text-destructive", className)}
      >
        <Trash2 aria-hidden="true" />
        {t("trigger")}
      </Button>
    );

  return (
    <DeleteQuoteDialog
      id={id}
      quotationNumber={quotationNumber}
      redirectTo={redirectTo}
      trigger={trigger}
    />
  );
}
