"use server";

import { Resend } from "resend";
import { db } from "@/db"; //
import { quotations } from "@/db/schema"; //
import { eq } from "drizzle-orm";
import { QuoteEmail } from "@/components/emails/quote-template";
import { QuotePDFDocument } from "@/components/pdf/QuotePDFDocument";
import { renderToBuffer, Font } from "@react-pdf/renderer";
import path from "path";
import process from "process";
import { MAIL_INFO } from "@/lib/company-info";
import { revalidatePath } from "next/cache";

// 1. 初始化 Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// 2. 在 Server Action 環境註冊字體 (必須！)
Font.register({
  family: "Noto Sans TC",
  src: path.join(process.cwd(), "public", "fonts", "NotoSansTC-Regular.ttf"),
});

// 定義回傳型別
type SendEmailState = {
  success?: boolean;
  error?: string;
};

// 3. 發送郵件 Action
export async function sendQuoteEmail(quote: any): Promise<SendEmailState> {
  try {
    if (!quote || !quote.customer?.email) {
      return { error: "No customer email found" };
    }

    // 4. 生成 PDF Buffer (這是在記憶體中產生 PDF 檔案)
    const pdfBuffer = await renderToBuffer(<QuotePDFDocument quote={quote} />);

    // 5. 寄出 Email (含附件)
    const { error } = await resend.emails.send({
      from: `${MAIL_INFO.name} <${MAIL_INFO.senderEmail}>`,
      to: [quote.customer.email],
      cc: MAIL_INFO.ccEmails,
      subject: `Quotation #${quote.quotationNumber} from Shangda Inc.`,
      react: <QuoteEmail quote={quote} />, // 你的 HTML Email Template

      attachments: [
        {
          filename: `Quote-${quote.quotationNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("Resend error:", error);
      return { error: error.message };
    }

    if (quote.id) {
      await db
        .update(quotations)
        .set({ status: "sent" })
        .where(eq(quotations.id, quote.id));

      revalidatePath(`/quotes/${quote.id}`);
      revalidatePath("/");
    }

    return { success: true };
  } catch (err) {
    console.error("Failed to send email:", err);
    return { error: "Failed to send email" };
  }
}
