"use server";

import { Resend } from "resend";
import { db } from "@/db";
import { quotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { QuoteEmail } from "@/components/emails/quote-template";
import { QuotePDFDocument } from "@/components/pdf/QuotePDFDocument";
import { renderToBuffer, Font } from "@react-pdf/renderer";
import path from "path";
import process from "process";
import { getAppConfig, getQuoteBranding } from "@/lib/config";
import { revalidatePath } from "next/cache";

// 在 Server Action 環境註冊字體 (必須！)
Font.register({
  family: "Noto Sans TC",
  src: path.join(process.cwd(), "public", "fonts", "NotoSansTC-Regular.ttf"),
});

type SendEmailState = {
  success?: boolean;
  error?: string;
};

export async function sendQuoteEmail(quote: any): Promise<SendEmailState> {
  try {
    const config = getAppConfig();
    if (!config.mail.enabled) {
      return { error: "Email is not configured (RESEND_API_KEY is missing)" };
    }
    if (!quote || !quote.customer?.email) {
      return { error: "No customer email found" };
    }

    const branding = getQuoteBranding();
    // Use the cleaned key from config, not process.env directly: docker
    // --env-file keeps surrounding quotes literally and Resend rejects a
    // quoted key with 400 "API key is invalid".
    const resend = new Resend(config.mail.apiKey);

    // 生成 PDF Buffer (在記憶體中產生 PDF 檔案)
    const pdfBuffer = await renderToBuffer(
      <QuotePDFDocument quote={quote} branding={branding} />
    );

    // 寄出 Email (含附件)
    const { error } = await resend.emails.send({
      from: `${config.mail.senderName} <${config.mail.senderEmail}>`,
      to: [quote.customer.email],
      cc: config.mail.ccEmails.length ? config.mail.ccEmails : undefined,
      subject: `Quotation #${quote.quotationNumber} from ${config.company.name}`,
      react: <QuoteEmail quote={quote} branding={branding} />,

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
