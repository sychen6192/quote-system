import { db } from "@/db";
import { quotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { renderToStream, Font } from "@react-pdf/renderer";
import { QuotePDFDocument } from "@/components/pdf/QuotePDFDocument";
import { NextResponse } from "next/server";
import path from "path";

Font.register({
  family: "Noto Sans TC",
  src: path.join(process.cwd(), "public", "fonts", "NotoSansTC-Regular.ttf"),
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
