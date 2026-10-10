"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Printer,
  Send,
  Share2,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHandle, SheetTitle } from "@/components/ui/sheet";
import { QUOTE_STATUS_VALUES, isQuoteStatus, type QuoteStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Link } from "@/navigation";
import { useQuoteDetail } from "./detail-context";

const STATUS_DOT: Record<QuoteStatus, string> = {
  draft: "bg-muted-foreground",
  sent: "bg-info",
  accepted: "bg-success",
  rejected: "bg-destructive",
};

function StatusDot({ status }: { status: QuoteStatus }) {
  return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} />;
}

const editHref = (id: number) => `/quotes/${id}/edit`;
const duplicateHref = (id: number) => ({ pathname: "/quotes/new", query: { from: String(id) } });

/** Desktop / tablet toolbar: Download PDF and Send first, then status, edit and the rest. */
export function QuoteToolbar({ className }: { className?: string }) {
  const t = useTranslations("QuoteActions");
  const { quote, downloadHref, openSendDialog } = useQuoteDetail();

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button asChild>
        {/* A plain link: popup blockers and standalone PWAs swallow new windows. */}
        <a href={downloadHref} download>
          <Download aria-hidden="true" />
          {t("downloadPdf")}
        </a>
      </Button>
      <Button variant="outline" onClick={openSendDialog}>
        <Send aria-hidden="true" />
        {t("sendEmail")}
      </Button>
      <StatusMenu />
      <Button asChild variant="outline">
        <Link href={editHref(quote.id)}>
          <Pencil aria-hidden="true" />
          {t("edit")}
        </Link>
      </Button>
      <MoreMenu />
    </div>
  );
}

function StatusMenu() {
  const t = useTranslations("QuoteActions");
  const tStatus = useTranslations("Status");
  const { status, statusPending, changeStatus } = useQuoteDetail();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-busy={statusPending || undefined}>
          <StatusDot status={status} />
          <span className="sr-only">{t("status.change")}: </span>
          {tStatus(status)}
          <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t("status.change")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(value) => {
            if (isQuoteStatus(value)) changeStatus(value);
          }}
        >
          {QUOTE_STATUS_VALUES.map((value) => (
            <DropdownMenuRadioItem key={value} value={value} className="gap-2 py-2">
              <StatusDot status={value} />
              {tStatus(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreMenu() {
  const t = useTranslations("QuoteActions");
  const { quote, prepareShare, share, print, openDeleteDialog } = useQuoteDetail();
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <DropdownMenu onOpenChange={(open) => open && prepareShare()}>
      <DropdownMenuTrigger asChild>
        <Button ref={triggerRef} variant="outline" size="icon" aria-label={t("more")} title={t("more")}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild className="gap-2 py-2">
          <Link href={duplicateHref(quote.id)}>
            <Copy aria-hidden="true" />
            {t("duplicate")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 py-2" onSelect={() => void share()}>
          <Share2 aria-hidden="true" />
          {t("share")}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 py-2" onSelect={print}>
          <Printer aria-hidden="true" />
          {t("print")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 py-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
          onSelect={() => openDeleteDialog(triggerRef)}
        >
          <Trash2 aria-hidden="true" />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Phones: a fixed bar with the two main actions and a sheet with the rest. */
export function MobileActionBar() {
  const t = useTranslations("QuoteActions");
  const { downloadHref, openSendDialog, prepareShare } = useQuoteDetail();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pb-safe-3 pt-3 shadow-[0_-4px_16px_-8px_hsl(var(--shadow-color)/0.15)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80 md:hidden print:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-2 pl-safe pr-safe">
          <Button asChild className="h-12 flex-1 text-[15px]">
            <a href={downloadHref} download>
              <Download aria-hidden="true" />
              {t("downloadPdf")}
            </a>
          </Button>
          <Button variant="outline" className="h-12 flex-1 text-[15px]" onClick={openSendDialog}>
            <Send aria-hidden="true" />
            {t("send")}
          </Button>
          <Button
            ref={moreRef}
            variant="outline"
            className="size-12 shrink-0 p-0"
            aria-label={t("more")}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => {
              prepareShare();
              setMoreOpen(true);
            }}
          >
            <MoreHorizontal aria-hidden="true" className="!size-5" />
          </Button>
        </div>
      </div>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} returnFocusRef={moreRef} />
    </>
  );
}

function SheetAction({
  icon,
  children,
  onClick,
  tone,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  tone?: "destructive";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-medium transition-colors hover:bg-muted active:bg-muted [&_svg]:size-5 [&_svg]:shrink-0",
        tone === "destructive" ? "text-destructive hover:bg-destructive/10" : "text-foreground [&_svg]:text-muted-foreground"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function MoreSheet({
  open,
  onOpenChange,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("QuoteActions");
  const tStatus = useTranslations("Status");
  const { quote, status, changeStatus, share, print, openDeleteDialog } = useQuoteDetail();

  // Close first, then act: the print dialog / share sheet / confirmation
  // should not open on top of this sheet.
  const run = (action: () => void) => () => {
    onOpenChange(false);
    window.setTimeout(action, 150);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 px-3 pt-3 pb-safe-4" closeLabel={t("more")}>
        <SheetHandle className="mb-3 mt-0" />
        <div className="px-3 pb-2">
          <SheetTitle className="text-base">{t("moreTitle", { number: quote.quotationNumber })}</SheetTitle>
          <SheetDescription className="sr-only">{t("more")}</SheetDescription>
        </div>

        <nav className="space-y-0.5">
          <Link
            href={editHref(quote.id)}
            onClick={() => onOpenChange(false)}
            className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium hover:bg-muted [&_svg]:size-5 [&_svg]:text-muted-foreground"
          >
            <Pencil aria-hidden="true" />
            {t("edit")}
          </Link>
          <Link
            href={duplicateHref(quote.id)}
            onClick={() => onOpenChange(false)}
            className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium hover:bg-muted [&_svg]:size-5 [&_svg]:text-muted-foreground"
          >
            <Copy aria-hidden="true" />
            {t("duplicate")}
          </Link>
          <SheetAction icon={<Share2 aria-hidden="true" />} onClick={() => {
            onOpenChange(false);
            // Called within the tap so the share sheet keeps its user activation.
            void share();
          }}>
            {t("share")}
          </SheetAction>
          <SheetAction icon={<Printer aria-hidden="true" />} onClick={run(print)}>
            {t("print")}
          </SheetAction>
        </nav>

        <div className="mx-3 my-3 border-t" />
        <fieldset className="px-3">
          <legend className="pb-2 text-xs font-medium text-muted-foreground">{t("status.change")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {QUOTE_STATUS_VALUES.map((value) => {
              const current = value === status;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={current}
                  onClick={() => {
                    if (!current) changeStatus(value);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex min-h-12 items-center gap-2.5 rounded-lg border px-3 text-left text-sm font-medium transition-colors",
                    current ? "border-primary bg-primary/5 text-foreground" : "hover:bg-muted"
                  )}
                >
                  <StatusDot status={value} />
                  <span className="flex-1">{tStatus(value)}</span>
                  {current ? <Check aria-hidden="true" className="size-4 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mx-3 my-3 border-t" />
        <SheetAction
          tone="destructive"
          icon={<Trash2 aria-hidden="true" />}
          onClick={run(() => openDeleteDialog(returnFocusRef))}
        >
          {t("delete")}
        </SheetAction>
      </SheetContent>
    </Sheet>
  );
}
