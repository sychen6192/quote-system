"use server";

import { Resend } from "resend";
import { QuoteEmailTemplate } from "@/components/emails/quote-template";
import { render } from "@react-email/render";

import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePDFServer } from "@/components/pdf/QuotePDFServer";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendQuoteEmail(quote: any) {
  try {
    // 檢查是否有 Email
    if (!quote.customer?.email) {
      return { success: false, error: "Customer has no email address" };
    }

    const pdfBuffer = await renderToBuffer(<QuotePDFServer quote={quote} />);

    const emailHtml = await render(
      QuoteEmailTemplate({
        quoteNumber: quote.quotationNumber,
        customerName:
          quote.customer.contactPerson || quote.customer.companyName,
        totalAmount: quote.totalAmount,
      })
    );

    const { data, error } = await resend.emails.send({
      from: "Shangda Int'l <quotes@sycomputer.org>",
      to: [quote.customer.email],
      subject: `Quotation #${quote.quotationNumber} from Shangda Int'l`,
      html: emailHtml,
      attachments: [
        {
          filename: `Quotation_${quote.quotationNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("Resend Error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Server Action Error:", error);
    return { success: false, error: "Failed to send email" };
  }
}
