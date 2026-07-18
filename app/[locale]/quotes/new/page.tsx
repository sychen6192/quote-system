import QuoteForm from "@/components/quote-form";
import { getAppConfig } from "@/lib/config";

export default function NewQuotePage() {
  const defaultValues = {
    items: [{ productName: "", quantity: 1, unitPrice: 0, isTaxable: true }],
    taxRate: getAppConfig().money.defaultTaxRate,
    issuedDate: new Date().toISOString().split("T")[0],
    validUntil: new Date(Date.now() + 30 * 86400000)
      .toISOString()
      .split("T")[0],
    companyName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    salesperson: "",
  };

  return (
    <div className="container mx-auto">
      <QuoteForm initialData={defaultValues} />
    </div>
  );
}
