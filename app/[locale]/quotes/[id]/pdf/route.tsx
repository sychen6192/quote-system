import { db } from "@/db";
import { quotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { renderToStream, Font } from "@react-pdf/renderer"; // 引入 Font
import { QuotePDFDocument } from "@/components/pdf/QuotePDFDocument";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs"; // ✅ 引入 fs 來 debug

// 1. 在 API 這裡註冊字體 (只會執行一次)
// 使用 process.cwd() 確保抓到正確的伺服器路徑
const fontPath = path.join(
  process.cwd(),
  "public",
  "fonts",
  "NotoSansTC-Regular.ttf"
);

if (!fs.existsSync(fontPath)) {
  console.error("❌ Font file not found at:", fontPath);
} else {
  console.log("✅ Font file found:", fontPath);
}

Font.register({
  family: "Noto Sans TC",
  src: fontPath,
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quoteId = Number(id);

  const quote = await db.query.quotations.findFirst({
    where: eq(quotations.id, quoteId),
    with: { customer: true, items: true },
  });

  if (!quote) return notFound();

  const stream = await renderToStream(<QuotePDFDocument quote={quote} />);

  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quote-${quote.quotationNumber}.pdf"`,
    },
  });
}
