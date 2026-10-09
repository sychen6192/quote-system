import { notFound } from "next/navigation";
import QuoteForm from "@/components/quote-form";
import { formValuesFromRecord } from "@/lib/quote-view";
import type { QuoteFormData } from "@/lib/schemas/quote";
import { getCustomerOptions } from "@/services/customers";
import { getQuoteById } from "@/services/quotes";

// 1. 定義 params 為 Promise
interface EditQuotePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuotePage({ params }: EditQuotePageProps) {
  // 2. 必須先 await 解開 params
  const { id } = await params;

  const quote = await getQuoteById(id);
  if (!quote) {
    notFound();
  }

  const companyOptions = await getCustomerOptions();

  // Every saved field goes into the form state (even ones the form has no
  // input for yet), so saving never drops title, discount, terms, etc.
  const initialData = {
    id: quote.id,
    ...(formValuesFromRecord(quote) as Partial<QuoteFormData>),
  };

  return (
    <div className="container mx-auto">
      <QuoteForm initialData={initialData} companyOptions={companyOptions} />
    </div>
  );
}
