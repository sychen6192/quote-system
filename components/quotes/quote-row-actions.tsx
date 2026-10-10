"use client";

import { useRef, useState } from "react";
import { Copy, Download, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { DownloadLink } from "@/components/app-shell/download-link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteQuoteDialog } from "@/components/delete-quote-button";
import { cn } from "@/lib/utils";

/** The ⋯ menu of a quote row/card: view, edit, duplicate, PDF, delete. */
export function QuoteRowActions({
  id,
  quotationNumber,
  className,
}: {
  id: number;
  quotationNumber: string;
  className?: string;
}) {
  const t = useTranslations("Common");
  const tList = useTranslations("QuotesList");
  const locale = useLocale();
  const [deleting, setDeleting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pdfHref = `/api/quotes/${id}/pdf?download=1&lang=${encodeURIComponent(locale)}`;
  const item = "min-h-10 cursor-pointer gap-2.5 md:min-h-8";

  return (
    <>
      {/* Non-modal: the delete dialog opens as the menu closes. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            data-row-actions=""
            variant="ghost"
            size="icon"
            aria-label={tList("actionsFor", { number: quotationNumber })}
            className={cn(
              "h-11 w-11 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground md:h-8 md:w-8",
              className
            )}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild className={item}>
            <Link href={`/quotes/${id}`}>
              <Eye aria-hidden="true" className="text-muted-foreground" />
              {t("view")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={item}>
            <Link href={`/quotes/${id}/edit`}>
              <Pencil aria-hidden="true" className="text-muted-foreground" />
              {t("edit")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={item}>
            <Link href={{ pathname: "/quotes/new", query: { from: String(id) } }}>
              <Copy aria-hidden="true" className="text-muted-foreground" />
              {t("duplicate")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={item}>
            <DownloadLink href={pdfHref}>
              <Download aria-hidden="true" className="text-muted-foreground" />
              {t("downloadPdf")}
            </DownloadLink>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleting(true)}
            className={cn(item, "text-destructive focus:bg-destructive/10 focus:text-destructive")}
          >
            <Trash2 aria-hidden="true" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteQuoteDialog
        id={id}
        quotationNumber={quotationNumber}
        open={deleting}
        onOpenChange={setDeleting}
        returnFocusRef={triggerRef}
      />
    </>
  );
}
