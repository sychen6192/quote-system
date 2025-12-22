import { db } from "@/db";
import { quotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Building2, Mail, Phone, MapPin } from "lucide-react";
import Link from "next/link";
import { getFormatter } from "next-intl/server";
// ✅ 引入新的 Actions 元件
import QuoteActions from "@/components/quote-actions";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function QuoteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const quoteId = Number(id);
  if (isNaN(quoteId)) notFound();

  // 1. 撈取資料
  const quote = await db.query.quotations.findFirst({
    where: eq(quotations.id, quoteId),
    with: {
      customer: true,
      items: true,
    },
  });

  if (!quote) return notFound();

  // 2. 初始化 Formatter
  const format = await getFormatter();

  // 3. 計算金額
  const subtotalCents = quote.items.reduce((acc, item) => {
    return acc + item.quantity * item.unitPrice;
  }, 0);

  const taxAmountCents = quote.totalAmount - subtotalCents;
  const taxRateDisplay = (Number(quote.taxRate) || 0) / 100;

  return (
    <div className="min-h-screen bg-gray-100/50 py-10 print:bg-white print:p-0">
      <div className="container mx-auto max-w-[210mm]">
        {/* --- 頂部動作列 (列印時會被 CSS 隱藏) --- */}
        <div className="flex justify-between items-center mb-8 print:hidden">
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to List
            </Button>
          </Link>

          {/* ✅ 替換為整合後的按鈕組 */}
          <QuoteActions quote={quote} />
        </div>

        {/* --- 報價單 A4 紙張區域 --- */}
        {/* ✅ 加上 id="printable-content" 讓 CSS 鎖定這個區塊列印 */}
        <div
          id="printable-content"
          className="bg-white shadow-xl rounded-sm border print:shadow-none print:border-none print:rounded-none min-h-[297mm] relative flex flex-col"
        >
          {/* 1. Header 品牌區 */}
          <div className="p-12 pb-8 border-b border-gray-100">
            <div className="flex justify-between items-start">
              {/* 左側：公司 Logo 與名稱 */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-slate-900 rounded flex items-center justify-center text-white">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      Shangda Inc.
                    </h2>
                    <p className="text-sm text-slate-500">
                      Tech Solutions Provider
                    </p>
                  </div>
                </div>

                <div className="text-sm text-slate-500 space-y-1 mt-4">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" /> 123 Tech Blvd, Taipei City,
                    Taiwan
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="h-3 w-3" /> billing@shangda.com
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-3 w-3" /> +886 2 2345 6789
                  </p>
                  <p className="font-medium text-slate-700">VAT: 50990180</p>
                </div>
              </div>

              {/* 右側：大標題 */}
              <div className="text-right">
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight uppercase">
                  Quotation
                </h1>
                <p className="text-slate-400 font-medium mt-1">
                  #{quote.quotationNumber}
                </p>

                {/* 狀態標籤 */}
                <div className="mt-4 inline-block px-4 py-1 rounded-full bg-slate-100 text-slate-600 text-sm font-semibold uppercase tracking-wide">
                  {new Date(quote.validUntil) < new Date()
                    ? "Expired"
                    : "Valid"}
                </div>
              </div>
            </div>
          </div>

          {/* 2. 資訊區塊 (灰底背景) */}
          <div className="bg-slate-50/80 p-12 py-8 grid grid-cols-2 gap-12 border-b border-gray-100">
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
                {quote.customer?.address || "No address provided"}
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

            {/* Quote Details */}
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Issued Date
                </h3>
                <p className="text-slate-900 font-medium">
                  {format.dateTime(new Date(quote.issuedDate), {
                    dateStyle: "medium",
                  })}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Valid Until
                </h3>
                <p className="text-red-600 font-medium">
                  {format.dateTime(new Date(quote.validUntil), {
                    dateStyle: "medium",
                  })}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Salesperson
                </h3>
                <p className="text-slate-900 font-medium">
                  {quote.salesperson || "-"}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Currency
                </h3>
                <p className="text-slate-900 font-medium">TWD (NT$)</p>
              </div>
            </div>
          </div>

          {/* 3. 商品表格 */}
          <div className="p-12 pt-8 flex-grow">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-900">
                  <th className="text-left py-3 font-bold text-slate-900 w-[50%]">
                    Item Description
                  </th>
                  <th className="text-right py-3 font-bold text-slate-900">
                    Qty
                  </th>
                  <th className="text-right py-3 font-bold text-slate-900">
                    Price
                  </th>
                  <th className="text-right py-3 font-bold text-slate-900">
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
                    <td className="py-4 pr-4 align-top">
                      <p className="font-semibold text-slate-900">
                        {item.productName}
                      </p>
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

          {/* 4. 總結區塊 */}
          <div className="px-12 pb-8">
            <div className="flex justify-end">
              <div className="w-1/2 lg:w-1/3 space-y-3">
                <div className="flex justify-between text-slate-500 text-sm">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-900 font-medium">
                    {format.number(subtotalCents / 100, {
                      style: "currency",
                      currency: "TWD",
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 text-sm">
                  <span>Tax ({taxRateDisplay}%)</span>
                  <span className="font-mono text-slate-900 font-medium">
                    {format.number(taxAmountCents / 100, {
                      style: "currency",
                      currency: "TWD",
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>

                <Separator className="bg-slate-900 my-2" />

                <div className="flex justify-between items-end py-2">
                  <span className="text-slate-900 font-bold text-lg">
                    Total Amount
                  </span>
                  <span className="text-slate-900 font-bold text-2xl font-mono">
                    {format.number(quote.totalAmount / 100, {
                      style: "currency",
                      currency: "TWD",
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. 底部資訊 (備註、銀行、簽名) */}
          <div className="mt-auto bg-slate-50 p-12 border-t border-gray-100 text-sm">
            <div className="grid grid-cols-2 gap-12">
              {/* 左：備註與銀行 */}
              <div className="space-y-6">
                {quote.notes && (
                  <div>
                    <h4 className="font-bold text-slate-900 mb-2">Notes</h4>
                    <p className="text-slate-500">{quote.notes}</p>
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
                        CTBC Bank (822)
                      </span>
                    </p>
                    <p>
                      Account Name:{" "}
                      <span className="font-medium text-slate-700">
                        Shangda Inc.
                      </span>
                    </p>
                    <p>
                      Account No:{" "}
                      <span className="font-medium text-slate-700">
                        1234-5678-9012
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* 右：簽名 */}
              <div className="flex flex-col justify-end items-end">
                <div className="w-48 text-center space-y-2">
                  <div className="h-16 border-b border-slate-900/20 mb-2"></div>
                  <p className="font-bold text-slate-900">
                    Authorized Signature
                  </p>
                  <p className="text-xs text-slate-400">Shangda Inc.</p>
                </div>
              </div>
            </div>

            {/* 頁尾版權 */}
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
