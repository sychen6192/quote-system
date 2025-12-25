import { db } from "@/db";
import { quotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Mail, Phone, MapPin, FileText } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import QuoteActions from "@/components/quote-actions";
import { COMPANY_INFO, PAYMENT_INFO } from "@/lib/company-info";
import { calculateQuoteFinancials, toPercentage } from "@/lib/utils";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function QuoteDetailPage({ params }: PageProps) {
  const t = await getTranslations("QuoteActions");
  const { id } = await params;
  const quoteId = Number(id);
  if (isNaN(quoteId)) notFound();

  const quote = await db.query.quotations.findFirst({
    where: eq(quotations.id, quoteId),
    with: {
      customer: true,
      items: true,
    },
  });

  if (!quote) return notFound();

  const format = await getFormatter();

  // 四捨五入計算稅額 (與後端邏輯保持一致)
  const taxRateDisplay = toPercentage(quote.taxRate || 0); // 500 -> 5
  const { subtotal, taxAmount, totalAmount } = quote;

  return (
    <div className="min-h-screen bg-gray-100/50 py-4 md:py-10 print:bg-white print:p-0">
      {/* 限制最大寬度，並在手機上增加左右邊距 px-4 */}
      <div className="container mx-auto max-w-[210mm] px-4 md:px-0">
        {/* --- 頂部動作列 --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
          <Link href="/" className="w-full md:w-auto">
            <Button variant="outline" className="gap-2 w-full md:w-auto">
              <ArrowLeft className="h-4 w-4" /> {t("backToList")}
            </Button>
          </Link>
          <div className="w-full md:w-auto">
            <QuoteActions quote={quote} />
          </div>
        </div>

        {/* --- 報價單主體 (模擬 A4 紙張) --- */}
        <div
          id="printable-content"
          className="bg-white shadow-xl rounded-sm border print:shadow-none print:border-none print:rounded-none min-h-[297mm] relative flex flex-col"
        >
          {/* 1. Header 區塊 */}
          {/* 關鍵修改：手機版 p-6 / 電腦版 p-12 */}
          <div className="p-6 md:p-12 pb-6 md:pb-8 border-b border-gray-100">
            {/* 關鍵修改：手機版 flex-col (垂直堆疊) / 電腦版 flex-row (左右並排) */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-8 md:gap-0">
              {/* 左側：公司資訊 */}
              <div className="space-y-4 w-full md:w-auto">
                <div className="flex items-center gap-3">
                  {/* 使用 Logo 圖片 */}
                  <img
                    src={COMPANY_INFO.logoBase64}
                    alt="Logo"
                    className="h-10 md:h-12 w-auto object-contain"
                  />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      {COMPANY_INFO.name}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Tech Solutions Provider
                    </p>
                  </div>
                </div>

                <div className="text-sm text-slate-500 space-y-2 mt-4">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 shrink-0" />{" "}
                    {COMPANY_INFO.address}
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="h-3 w-3 shrink-0" /> {COMPANY_INFO.email}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-3 w-3 shrink-0" /> {COMPANY_INFO.phone}
                  </p>
                  <p className="flex items-center gap-2">
                    <FileText className="h-3 w-3 shrink-0" />{" "}
                    {COMPANY_INFO.vatNumber}
                  </p>
                </div>
              </div>

              {/* 右側：標題與單號 */}
              <div className="text-left md:text-right w-full md:w-auto">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight uppercase">
                  Quotation
                </h1>
                <p className="text-slate-400 font-medium mt-1">
                  #{quote.quotationNumber}
                </p>

                <div className="mt-4 inline-block px-4 py-1 rounded-full bg-slate-100 text-slate-600 text-sm font-semibold uppercase tracking-wide">
                  {new Date(quote.validUntil) < new Date()
                    ? "Expired"
                    : "Valid"}
                </div>
              </div>
            </div>
          </div>

          {/* 2. 資訊區塊 (Bill To & Dates) */}
          {/* 關鍵修改：手機版 p-6, grid-cols-1 / 電腦版 p-12, grid-cols-2 */}
          <div className="bg-slate-50/80 p-6 md:p-12 md:py-8 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 border-b border-gray-100">
            {/* Bill To */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Bill To
              </h3>
              <div className="text-slate-900 font-bold text-lg mb-1">
                {quote.customer?.companyName}
              </div>
              <div className="text-slate-600 text-sm leading-relaxed">
                <span className="font-medium">Attn:</span>{" "}
                {quote.customer?.contactPerson}
                <br />
                {quote.customer?.address || "-"}
                <br />
                {quote.customer?.email}
                <br />
                {quote.customer?.phone}
              </div>
              {quote.customer?.vatNumber && (
                <div className="mt-2 text-sm text-slate-600">
                  <span className="font-medium">VAT:</span>{" "}
                  {quote.customer.vatNumber}
                </div>
              )}
            </div>

            {/* Dates & Salesperson */}
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <InfoField
                label="Issued Date"
                value={format.dateTime(
                  new Date(quote.issuedDate ?? new Date()),
                  {
                    dateStyle: "medium",
                  }
                )}
              />
              <InfoField
                label="Valid Until"
                value={format.dateTime(new Date(quote.validUntil), {
                  dateStyle: "medium",
                })}
                valueClassName="text-red-600"
              />
              <InfoField label="Salesperson" value={quote.salesperson || "-"} />
              <InfoField label="Currency" value="TWD (NT$)" />
            </div>
          </div>

          {/* 3. 商品表格 */}
          {/* 關鍵修改：加入 overflow-x-auto 讓表格在手機上可以左右滑動，不會撐爆畫面 */}
          <div className="p-6 md:p-12 pt-8 flex-grow overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b-2 border-slate-900">
                  <th className="text-left py-3 font-bold text-slate-900 w-[45%]">
                    Item Description
                  </th>
                  <th className="text-right py-3 font-bold text-slate-900 w-[15%]">
                    Qty
                  </th>
                  <th className="text-right py-3 font-bold text-slate-900 w-[20%]">
                    Price
                  </th>
                  <th className="text-right py-3 font-bold text-slate-900 w-[20%]">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {quote.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-4 pr-4 align-top font-semibold text-slate-900">
                      {item.productName}
                    </td>
                    <td className="py-4 text-right align-top font-mono">
                      {item.quantity}
                    </td>
                    <td className="py-4 text-right align-top font-mono">
                      {format.number(item.unitPrice / 100, {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="py-4 text-right align-top font-mono font-medium text-slate-900">
                      {format.number((item.quantity * item.unitPrice) / 100, {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. 金額總計 */}
          <div className="px-6 md:px-12 pb-8">
            <div className="flex justify-end">
              <div className="w-full md:w-1/2 lg:w-1/3 space-y-3">
                <SummaryRow label="Subtotal" value={subtotal} format={format} />
                <SummaryRow
                  label={`Tax (${taxRateDisplay}%)`}
                  value={taxAmount}
                  format={format}
                />

                <Separator className="bg-slate-900 my-2" />

                <div className="flex justify-between items-end py-2">
                  <span className="text-slate-900 font-bold text-lg">
                    Total Amount
                  </span>
                  <span className="text-slate-900 font-bold text-2xl font-mono">
                    {format.number(totalAmount / 100, {
                      style: "currency",
                      currency: "TWD",
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. 底部資訊 */}
          {/* 關鍵修改：手機版排版調整 */}
          <div className="mt-auto bg-slate-50 p-6 md:p-12 border-t border-gray-100 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
              {/* 備註與銀行 */}
              <div className="space-y-6">
                {quote.notes && (
                  <div>
                    <h4 className="font-bold text-slate-900 mb-2">Notes</h4>
                    <p className="text-slate-500 whitespace-pre-wrap">
                      {quote.notes}
                    </p>
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">
                    Payment Details
                  </h4>
                  <div className="text-slate-500 space-y-1">
                    <p>
                      Bank:{" "}
                      <span className="font-medium text-slate-700">
                        {PAYMENT_INFO.bankName}
                      </span>
                    </p>
                    <p>
                      Account:{" "}
                      <span className="font-medium text-slate-700">
                        {PAYMENT_INFO.accountName}
                      </span>
                    </p>
                    <p>
                      No:{" "}
                      <span className="font-medium text-slate-700">
                        {PAYMENT_INFO.accountNumber}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* 簽名區 */}
              <div className="flex flex-col justify-start md:justify-end items-start md:items-end mt-4 md:mt-0">
                <div className="w-48 text-center space-y-2">
                  <div className="h-16 border-b border-slate-900/20 mb-2"></div>
                  <p className="font-bold text-slate-900">
                    Authorized Signature
                  </p>
                  <p className="text-xs text-slate-400">{COMPANY_INFO.name}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
              Thank you for your business! If you have any questions, please
              contact us.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 小元件 (保持程式碼乾淨) ---
function InfoField({
  label,
  value,
  valueClassName = "text-slate-900",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </h3>
      <p className={`font-medium ${valueClassName}`}>{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: any;
}) {
  return (
    <div className="flex justify-between text-slate-500 text-sm">
      <span>{label}</span>
      <span className="font-mono text-slate-900 font-medium">
        {format.number(value / 100, {
          style: "currency",
          currency: "TWD",
          maximumFractionDigits: 0,
        })}
      </span>
    </div>
  );
}
