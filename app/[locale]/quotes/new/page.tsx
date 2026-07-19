import QuoteForm from "@/components/quote-form";
import { getAppConfig } from "@/lib/config";
import { getCustomerOptions } from "@/services/customers";

// 每次請求即時渲染:預設日期要是「今天」,稅率要反映 runtime env,不能在 build 期凍結
export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const companyOptions = await getCustomerOptions();
  const defaultValues = {
    items: [{ productName: "", quantity: 1, unitPrice: 0, isTaxable: true }],
    taxRate: getAppConfig().money.defaultTaxRate,
    issuedDate: new Date().toISOString().split("T")[0],
    // eslint-disable-next-line react-hooks/purity -- server-rendered per request; current time is intentional
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
      <QuoteForm initialData={defaultValues} companyOptions={companyOptions} />
    </div>
  );
}
