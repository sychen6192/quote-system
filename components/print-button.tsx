"use client"; // 👈 這一行是關鍵

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" /> Print / PDF
    </Button>
  );
}
