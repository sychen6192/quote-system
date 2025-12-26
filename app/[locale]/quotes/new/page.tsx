import QuoteForm from "@/components/quote-form";

export default function NewQuotePage() {
  const defaultValues = {
    items: [{ productName: "", quantity: 1, unitPrice: 0, isTaxable: true }],
    taxRate: 5,
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
