"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Download, Printer } from "lucide-react";
import SendEmailButton from "@/components/send-email-button";
import { DeleteQuoteButton } from "@/components/delete-quote-button";
import { type InferSelectModel } from "drizzle-orm";
import { customers, quotations, quotationItems } from "@/db/schema";
import { useLocale, useTranslations } from "next-intl";

type QuoteWithRelations = InferSelectModel<typeof quotations> & {
  customer: InferSelectModel<typeof customers> | null;
  items: InferSelectModel<typeof quotationItems>[];
};

interface QuoteActionsProps {
  quote: QuoteWithRelations;
  mailEnabled: boolean;
}

export default function QuoteActions({ quote, mailEnabled }: QuoteActionsProps) {
  const t = useTranslations("QuoteActions");
  const locale = useLocale();
  // A plain link (not window.open): popup blockers and standalone PWAs
  // swallow new windows; the route answers with Content-Disposition: attachment.
  const pdfUrl = `/api/quotes/${quote.id}/pdf?download=1&lang=${encodeURIComponent(locale)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      <DeleteQuoteButton
        id={quote.id}
        quotationNumber={quote.quotationNumber}
        variant="button"
      />
      <SendEmailButton quote={quote} mailEnabled={mailEnabled} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {t("export")}{" "}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />{" "}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild className="cursor-pointer">
            <a href={pdfUrl} download>
              <Download className="mr-2 h-4 w-4" /> {t("downloadPdf")}{" "}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handlePrint} className="cursor-pointer">
            <Printer className="mr-2 h-4 w-4" /> {t("print")}{" "}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
