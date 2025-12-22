"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function DownloadPDFButton({ quoteId }: { quoteId: number }) {
  const handleDownload = () => {
    // 直接打開 API 連結即可觸發下載
    window.open(`/api/quotes/${quoteId}/pdf`, "_blank");
  };

  return (
    <Button variant="outline" onClick={handleDownload}>
      <Download className="mr-2 h-4 w-4" /> PDF
    </Button>
  );
}
