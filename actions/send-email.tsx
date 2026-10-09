"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { render, toPlainText } from "@react-email/render";
import { Resend } from "resend";
import { z } from "zod";
import { db } from "@/db";
import { quotations } from "@/db/schema";
import { QuoteEmail } from "@/components/emails/quote-template";
import { QuotePDFDocument } from "@/components/pdf/QuotePDFDocument";
import { DEFAULT_LOCALE, LOCALES, type AppLocale } from "@/i18n/locales";
import type { QuoteBranding } from "@/lib/config";
import { registerPdfFonts } from "@/lib/pdf/fonts";
import { quoteIdSchema, toFieldErrors } from "@/lib/schemas/quote";
import { createRateLimiter, getClientIp } from "@/lib/server/rate-limit";
import { normalizeStatus } from "@/lib/status";
import { recordQuoteEvent } from "@/services/events";
import { getQuoteById } from "@/services/quotes";
import { getDocumentBranding, getSettings } from "@/services/settings";
import {
  notFound,
  rateLimited,
  requireAuth,
  validationError,
  type ActionFailure,
} from "./types";

export type SendEmailResult =
  | { success: true }
  | ActionFailure
  | {
      success: false;
      code: "MAIL_DISABLED" | "NO_RECIPIENT" | "SEND_FAILED";
      message: string;
    };

const emailAddress = z
  .string({ error: "invalidEmail" })
  .trim()
  .pipe(z.email({ error: "invalidEmail" }).max(254, "tooLong"));

const sendEmailSchema = z.object({
  id: quoteIdSchema,
  /** defaults to the customer's email */
  to: z.union([z.literal(""), emailAddress], { error: "invalidEmail" }).optional(),
  cc: z.array(emailAddress, { error: "invalidEmail" }).max(5, "tooManyRecipients").optional(),
  message: z.string({ error: "invalidText" }).max(2000, "messageTooLong").optional(),
  locale: z.enum(LOCALES, { error: "invalidLocale" }).optional(),
}, { error: "invalidValue" });

export type SendEmailInput = z.input<typeof sendEmailSchema>;

// Per process; stops a leaked session (or an open install) from turning the
// verified sender domain into a spam relay.
const limiter = createRateLimiter({ windowMs: 60 * 60_000, max: 20 });

/** RFC 5322 display name: quoted, with " and \ escaped and no line breaks. */
function fromHeader(name: string, email: string): string {
  const clean = name.replace(/[\r\n]+/g, " ").trim();
  if (!clean) return email;
  return `"${clean.replace(/(["\\])/g, "\\$1")}" <${email}>`;
}

function defaultLocale(currencyLocale: string): AppLocale {
  const exact = LOCALES.find((l) => l.toLowerCase() === currencyLocale.toLowerCase());
  if (exact) return exact;
  return currencyLocale.toLowerCase().startsWith("zh") ? "zh-TW" : DEFAULT_LOCALE;
}

// TODO(wave B): move to an "Email" messages namespace with the redesigned template.
function subjectFor(locale: AppLocale, quotationNumber: string, company: string): string {
  return locale === "zh-TW"
    ? `${company} 報價單 ${quotationNumber}`
    : `Quotation ${quotationNumber} from ${company}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// QuoteEmail has no slot for a personal note yet (wave B adds one), so the
// note is placed at the top of the rendered body.
function withPersonalMessage(html: string, message: string): string {
  if (!message.trim()) return html;
  const block =
    `<div style="max-width:500px;margin:24px auto 0;padding:0 16px;font-family:sans-serif;` +
    `font-size:15px;line-height:1.6;color:#0f172a;white-space:pre-wrap">` +
    `${escapeHtml(message.trim())}</div>`;
  return /<body[^>]*>/i.test(html)
    ? html.replace(/<body[^>]*>/i, (tag) => tag + block)
    : block + html;
}

function pdfFilename(quotationNumber: string): string {
  return `Quote-${quotationNumber.replace(/[\\/:*?"<>|\r\n]/g, "_")}.pdf`;
}

function uniqueEmails(emails: string[], exclude: string): string[] {
  const seen = new Set([exclude.toLowerCase()]);
  return emails.filter((e) => {
    const key = e.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Emails a quote as a PDF attachment. Everything in the message is loaded
 * from the database by id; the client only picks recipient, CC, note and
 * language.
 */
export async function sendQuoteEmail(input: unknown): Promise<SendEmailResult> {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = sendEmailSchema.safeParse(input);
  if (!parsed.success) return validationError(toFieldErrors(parsed.error));
  const { id, to, cc = [], message = "", locale } = parsed.data;

  try {
    const settings = await getSettings();
    if (!settings.mail.enabled) {
      return { success: false, code: "MAIL_DISABLED", message: "Email is not configured" };
    }

    const limit = limiter.check(getClientIp(await headers()));
    if (!limit.ok) return rateLimited(limit.retryAfterMs);

    const quote = await getQuoteById(id);
    if (!quote) return notFound(`Quote ${id}`);

    const recipient = to || quote.customer?.email?.trim() || "";
    if (!emailAddress.safeParse(recipient).success) {
      return { success: false, code: "NO_RECIPIENT", message: "No recipient email address" };
    }
    const ccList = uniqueEmails([...settings.mail.ccEmails, ...cc], recipient);
    const lang = locale ?? defaultLocale(settings.money.currencyLocale);

    const doc = await getDocumentBranding("pdf");
    const branding: QuoteBranding = {
      company: doc.company,
      logoDataUri: doc.logoSrc,
      stampDataUri: doc.stampSrc,
      payment: doc.payment,
      money: {
        currency: doc.currency,
        currencyLocale: doc.currencyLocale,
        defaultTaxRate: settings.quote.defaultTaxRate,
      },
    };

    registerPdfFonts();
    const pdf = await renderToBuffer(<QuotePDFDocument quote={quote} branding={branding} />);
    const html = withPersonalMessage(
      await render(<QuoteEmail quote={quote} branding={branding} />),
      message
    );

    const companyName =
      (lang === "zh-TW" && settings.company.nameLocal) || settings.company.name;
    const replyTo = settings.mail.replyTo || settings.company.email;

    const resend = new Resend(settings.mail.apiKey);
    const { error } = await resend.emails.send({
      from: fromHeader(settings.mail.senderName, settings.mail.senderEmail),
      to: [recipient],
      cc: ccList.length ? ccList : undefined,
      replyTo: replyTo || undefined,
      subject: subjectFor(lang, quote.quotationNumber, companyName),
      html,
      text: toPlainText(html),
      attachments: [{ filename: pdfFilename(quote.quotationNumber), content: pdf }],
    });
    if (error) {
      console.error("sendQuoteEmail: Resend rejected the message:", error);
      return { success: false, code: "SEND_FAILED", message: "The email could not be sent" };
    }

    try {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .select({ status: quotations.status })
          .from(quotations)
          .where(eq(quotations.id, id))
          .for("update");
        if (!row) return;
        const from = normalizeStatus(row.status);
        const now = new Date();
        await tx
          .update(quotations)
          .set({ ...(from === "draft" ? { status: "sent" as const } : {}), sentAt: now, updatedAt: now })
          .where(eq(quotations.id, id));
        await recordQuoteEvent(tx, id, "emailed", { to: recipient, cc: ccList });
        if (from === "draft") {
          await recordQuoteEvent(tx, id, "status_changed", { from, to: "sent" });
        }
      });
      revalidatePath("/[locale]", "layout");
    } catch (error) {
      // The email is already out; report success but keep the failure visible in logs.
      console.error("sendQuoteEmail: sent, but recording it failed:", error);
    }
    return { success: true };
  } catch (error) {
    console.error("sendQuoteEmail failed:", error);
    return { success: false, code: "SEND_FAILED", message: "The email could not be sent" };
  }
}
