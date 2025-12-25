import { db } from "@/db";
import { quotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import QuoteForm from "@/components/quote-form";

// 1. 定義 params 為 Promise
interface EditQuotePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuotePage({ params }: EditQuotePageProps) {
  // 2. 必須先 await 解開 params
  const { id } = await params;

  const quoteId = Number(id);

  if (isNaN(quoteId)) {
    notFound();
  }

  const quote = await db.query.quotations.findFirst({
    where: eq(quotations.id, quoteId),
    with: {
      customer: true,
      items: true,
    },
  });

  if (!quote) {
    notFound();
  }

  const initialData = {
    id: quote.id,
    companyName: quote.customer?.companyName || "",
    contactPerson: quote.customer?.contactPerson || "",
    email: quote.customer?.email || "",
    phone: quote.customer?.phone || "",
    vatNumber: quote.customer?.vatNumber || "",
    address: quote.customer?.address || "",
    salesperson: quote.salesperson || "",
    issuedDate: quote.issuedDate
      ? new Date(quote.issuedDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    validUntil: new Date(quote.validUntil).toISOString().split("T")[0],
    taxRate: (Number(quote.taxRate) || 0) / 100,
    items: quote.items.map((item) => ({
      productName: item.productName || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice / 100,
      isTaxable: item.isTaxable ?? true,
    })),
  };

  return (
    <div className="container mx-auto">
      <QuoteForm initialData={initialData} />
    </div>
  );
}
