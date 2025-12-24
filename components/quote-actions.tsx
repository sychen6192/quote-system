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
import { type InferSelectModel } from "drizzle-orm";
import { customers, quotations, quotationItems } from "@/db/schema";
import { useTranslations } from "next-intl";

type QuoteWithRelations = InferSelectModel<typeof quotations> & {
  customer: InferSelectModel<typeof customers> | null;
  items: InferSelectModel<typeof quotationItems>[];
};

interface QuoteActionsProps {
  quote: QuoteWithRelations;
}

export default function QuoteActions({ quote }: QuoteActionsProps) {
  const t = useTranslations("QuoteActions");

  const handleDownload = () => {
    window.open(`/api/quotes/${quote.id}/pdf`, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      <SendEmailButton quote={quote} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {t("export")}{" "}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />{" "}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
            <Download className="mr-2 h-4 w-4" /> {t("downloadPdf")}{" "}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handlePrint} className="cursor-pointer">
            <Printer className="mr-2 h-4 w-4" /> {t("print")}{" "}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
