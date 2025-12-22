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

interface QuoteActionsProps {
  quote: any;
}

export default function QuoteActions({ quote }: QuoteActionsProps) {
  // 處理 PDF 下載
  const handleDownload = () => {
    // 使用 window.open 觸發 API 下載
    // _blank 確保不會影響當前頁面
    window.open(`/api/quotes/${quote.id}/pdf`, "_blank");
  };

  // 處理列印
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      {/* ✅ 關鍵修正：Send Email 放在外面，避免被 Dropdown 關閉邏輯影響 */}
      <SendEmailButton quote={quote} />

      {/* 匯出選單 (PDF & Print) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            Export <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handlePrint} className="cursor-pointer">
            <Printer className="mr-2 h-4 w-4" /> Print (Browser)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
