"use server";

import { Resend } from "resend";
import { QuoteEmail } from "@/components/emails/quote-template";
// 引入 PDF 文件與渲染器
import { QuotePDFDocument } from "@/components/pdf/QuotePDFDocument";
import { renderToBuffer, Font } from "@react-pdf/renderer";
import path from "path";
import process from "process";

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
    const { data, error } = await resend.emails.send({
      from: "Shangda Inc. <billing@sycomputer.org>", // 請換成你驗證過的網域 Email
      to: [quote.customer.email],
      subject: `Quotation #${quote.quotationNumber} from Shangda Inc.`,
      react: <QuoteEmail quote={quote} />, // 你的 HTML Email Template

      // ✅ 這裡就是附加檔案的關鍵
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

    return { success: true };
  } catch (err) {
    console.error("Failed to send email:", err);
    return { error: "Failed to send email" };
  }
}
