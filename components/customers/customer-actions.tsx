"use client";

import { Copy, ExternalLink, FileText, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { copyWithToast } from "./copy";

const ITEM = "min-h-10 cursor-pointer gap-2.5 md:min-h-8";

/** ⋯ menu of a customer: view their quotes, open the latest, copy contacts. */
export function CustomerActionsMenu({
  name,
  email,
  phone,
  lastQuoteId,
  className,
}: {
  name: string;
  email: string | null;
  phone: string | null;
  lastQuoteId: number | null;
  className?: string;
}) {
  const t = useTranslations("Customers");
  const tCommon = useTranslations("Common");

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("actionsFor", { name })}
          className={cn(
            "h-11 w-11 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted md:h-8 md:w-8",
            className
          )}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild className={ITEM}>
          <Link href={{ pathname: "/quotes", query: { customer: name } }}>
            <FileText aria-hidden="true" className="text-muted-foreground" />
            {t("viewQuotes")}
          </Link>
        </DropdownMenuItem>
        {lastQuoteId !== null ? (
          <DropdownMenuItem asChild className={ITEM}>
            <Link href={`/quotes/${lastQuoteId}`}>
              <ExternalLink aria-hidden="true" className="text-muted-foreground" />
              {t("openLastQuote")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {email || phone ? <DropdownMenuSeparator /> : null}
        {email ? (
          <DropdownMenuItem
            className={ITEM}
            onSelect={() => void copyWithToast(email, t("emailCopied"), tCommon("copyFailed"))}
          >
            <Copy aria-hidden="true" className="text-muted-foreground" />
            {t("copyEmail")}
          </DropdownMenuItem>
        ) : null}
        {phone ? (
          <DropdownMenuItem
            className={ITEM}
            onSelect={() => void copyWithToast(phone, t("phoneCopied"), tCommon("copyFailed"))}
          >
            <Copy aria-hidden="true" className="text-muted-foreground" />
            {t("copyPhone")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Small copy-to-clipboard icon button next to an email / phone number. */
export function CopyButton({
  value,
  label,
  copiedMessage,
  className,
}: {
  value: string;
  label: string;
  copiedMessage: string;
  className?: string;
}) {
  const tCommon = useTranslations("Common");
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => void copyWithToast(value, copiedMessage, tCommon("copyFailed"))}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Copy aria-hidden="true" className="size-3.5" />
    </button>
  );
}
