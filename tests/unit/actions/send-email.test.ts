jest.mock("@/db", () => ({ db: { transaction: jest.fn() } }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/headers", () => ({ headers: jest.fn() }));
jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));
jest.mock("@/services/settings", () => ({
  getSettings: jest.fn(),
  getDocumentBranding: jest.fn(),
}));
jest.mock("@/services/quotes", () => ({ getQuoteById: jest.fn() }));
jest.mock("@/lib/pdf/fonts", () => ({ registerPdfFonts: jest.fn() }));
jest.mock("@react-pdf/renderer", () => ({ renderToBuffer: jest.fn() }));
jest.mock("@react-email/render", () => ({ render: jest.fn(), toPlainText: jest.fn() }));
jest.mock("@/components/pdf/QuotePDFDocument", () => ({ QuotePDFDocument: () => null }));
jest.mock("@/components/emails/quote-template", () => ({ QuoteEmail: () => null }));
jest.mock("resend", () => {
  const send = jest.fn();
  return { Resend: jest.fn(() => ({ emails: { send } })), __send: send };
});

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { render, toPlainText } from "@react-email/render";
import { sendQuoteEmail } from "@/actions/send-email";
import { db } from "@/db";
import { assertAuthenticated } from "@/lib/auth/guard";
import { registerPdfFonts } from "@/lib/pdf/fonts";
import { getQuoteById } from "@/services/quotes";
import { getDocumentBranding, getSettings } from "@/services/settings";
import { createTxMock, testSettings } from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockSend: jest.Mock = require("resend").__send;
const mockTransaction = db.transaction as jest.Mock;
const mockAuth = assertAuthenticated as jest.Mock;
const mockHeaders = headers as jest.Mock;
const mockSettings = getSettings as jest.Mock;
const mockQuote = getQuoteById as jest.Mock;

let ipCounter = 0;
let txMock: ReturnType<typeof createTxMock>;

function quoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    quotationNumber: "QT-20261009-001",
    status: "draft",
    totalAmount: 105_000,
    customer: { companyName: "Buyer Co", email: "buyer@example.test" },
    items: [],
    events: [],
    ...overrides,
  };
}

function useTx(status: string) {
  txMock = createTxMock({ select: [[{ status }]] });
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txMock.tx));
}

beforeEach(() => {
  ipCounter += 1;
  mockAuth.mockResolvedValue(undefined);
  mockHeaders.mockResolvedValue(new Headers({ "x-forwarded-for": `10.0.0.${ipCounter}` }));
  mockSettings.mockResolvedValue(testSettings());
  (getDocumentBranding as jest.Mock).mockResolvedValue({
    company: testSettings().company,
    payment: null,
    logoSrc: "data:image/png;base64,AAAA",
    stampSrc: null,
    brandColor: "#1D4ED8",
    currency: "TWD",
    currencyLocale: "zh-TW",
    fractionDigits: 0,
    showAmountInWords: true,
    footerText: "",
    timezone: "Asia/Taipei",
  });
  mockQuote.mockResolvedValue(quoteRow());
  (renderToBuffer as jest.Mock).mockResolvedValue(Buffer.from("%PDF-1.7"));
  (render as jest.Mock).mockResolvedValue('<html><body style="margin:0"><p>Quote</p></body></html>');
  (toPlainText as jest.Mock).mockReturnValue("Quote");
  mockSend.mockResolvedValue({ data: { id: "email_1" }, error: null });
  useTx("draft");
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const sent = () => mockSend.mock.calls[0][0];

describe("sendQuoteEmail", () => {
  it("returns UNAUTHORIZED first", async () => {
    mockAuth.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    await expect(sendQuoteEmail({ id: 5 })).resolves.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it.each([
    [{ id: "5" }, "id", "invalidId"],
    [{ id: 5, to: "nope" }, "to", "invalidEmail"],
    [{ id: 5, to: 42 }, "to", "invalidEmail"],
    [{ id: 5, cc: "a@x.test" }, "cc", "invalidEmail"],
    [{ id: 5, cc: ["a@x.test", "bad"] }, "cc.1", "invalidEmail"],
    [{ id: 5, cc: ["a@x.tw", "b@x.tw", "c@x.tw", "d@x.tw", "e@x.tw", "f@x.tw"] }, "cc", "tooManyRecipients"],
    [{ id: 5, message: "x".repeat(2001) }, "message", "messageTooLong"],
    [{ id: 5, locale: "fr" }, "locale", "invalidLocale"],
  ])("validates %j", async (input, field, key) => {
    const res = await sendQuoteEmail(input);
    expect(res).toMatchObject({ success: false, code: "VALIDATION" });
    if (!res.success && res.code === "VALIDATION") expect(res.fieldErrors[field]).toContain(key);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns MAIL_DISABLED when no API key is configured", async () => {
    mockSettings.mockResolvedValue(
      testSettings({ mail: { ...testSettings().mail, enabled: false, apiKey: "" } })
    );
    await expect(sendQuoteEmail({ id: 5 })).resolves.toMatchObject({ code: "MAIL_DISABLED" });
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for an unknown quote", async () => {
    mockQuote.mockResolvedValue(null);
    await expect(sendQuoteEmail({ id: 5 })).resolves.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns NO_RECIPIENT when neither `to` nor the customer email is set", async () => {
    mockQuote.mockResolvedValue(quoteRow({ customer: { companyName: "Buyer", email: null } }));
    await expect(sendQuoteEmail({ id: 5 })).resolves.toMatchObject({ code: "NO_RECIPIENT" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("loads everything from the DB and ignores client-supplied quote data", async () => {
    const res = await sendQuoteEmail({
      id: 5,
      customer: { email: "attacker@evil.test" },
      quotationNumber: "FAKE",
      totalAmount: 1,
    });
    expect(res).toEqual({ success: true });
    expect(mockQuote).toHaveBeenCalledWith(5);
    expect(sent().to).toEqual(["buyer@example.test"]);
    expect(sent().subject).toContain("QT-20261009-001");
  });

  it("builds a safe, localised message with the PDF attached", async () => {
    mockSettings.mockResolvedValue(
      testSettings({ mail: { ...testSettings().mail, ccEmails: ["boss@acme.test", "Buyer@Example.test"] } })
    );
    await sendQuoteEmail({
      id: 5,
      cc: ["boss@acme.test", "pm@acme.test"],
      message: "Hi <b>there</b>\nSee attached & thanks",
    });

    const message = sent();
    expect(message.from).toBe('"Acme, Inc." <quotes@acme.test>');
    expect(message.to).toEqual(["buyer@example.test"]);
    expect(message.cc).toEqual(["boss@acme.test", "pm@acme.test"]);
    expect(message.replyTo).toBe("office@acme.test");
    // default language follows the money locale (zh-TW) and uses the local name
    expect(message.subject).toBe("艾克米有限公司 報價單 QT-20261009-001");
    expect(message.attachments).toEqual([
      { filename: "Quote-QT-20261009-001.pdf", content: Buffer.from("%PDF-1.7") },
    ]);
    expect(message.html).toMatch(
      /<body style="margin:0"><div[^>]*>Hi &lt;b&gt;there&lt;\/b&gt;\nSee attached &amp; thanks<\/div><p>Quote<\/p>/
    );
    expect(message.text).toBe("Quote");
    expect(registerPdfFonts).toHaveBeenCalled();
  });

  it("honours `to`, `locale` and the configured reply-to", async () => {
    mockSettings.mockResolvedValue(
      testSettings({ mail: { ...testSettings().mail, replyTo: "sales@acme.test" } })
    );
    await sendQuoteEmail({ id: 5, to: " other@example.test ", locale: "en" });
    expect(sent()).toMatchObject({
      to: ["other@example.test"],
      replyTo: "sales@acme.test",
      subject: "Quotation QT-20261009-001 from Acme Ltd",
    });
  });

  it("quotes and escapes the From display name", async () => {
    mockSettings.mockResolvedValue(
      testSettings({ mail: { ...testSettings().mail, senderName: 'Say "hi" \\ Co\r\nBcc: x@y' } })
    );
    await sendQuoteEmail({ id: 5 });
    expect(sent().from).toBe('"Say \\"hi\\" \\\\ Co Bcc: x@y" <quotes@acme.test>');
  });

  it("marks a draft as sent and records emailed + status_changed events", async () => {
    await expect(sendQuoteEmail({ id: 5 })).resolves.toEqual({ success: true });
    const set = txMock.argsOf("update", "set")[0] as Record<string, unknown>;
    expect(set.status).toBe("sent");
    expect(set.sentAt).toBeInstanceOf(Date);
    expect(txMock.argsOf("insert", "values")).toEqual([
      { quoteId: 5, type: "emailed", data: { to: "buyer@example.test", cc: [] } },
      { quoteId: 5, type: "status_changed", data: { from: "draft", to: "sent" } },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
  });

  it("does not downgrade an accepted quote when re-sending", async () => {
    useTx("accepted");
    await sendQuoteEmail({ id: 5 });
    const set = txMock.argsOf("update", "set")[0] as Record<string, unknown>;
    expect(set).not.toHaveProperty("status");
    expect(set.sentAt).toBeInstanceOf(Date);
    expect(txMock.argsOf("insert", "values")).toHaveLength(1);
  });

  it("maps a Resend error to SEND_FAILED without leaking it", async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: "API key is invalid", name: "validation_error" } });
    const res = await sendQuoteEmail({ id: 5 });
    expect(res).toMatchObject({ success: false, code: "SEND_FAILED" });
    expect(JSON.stringify(res)).not.toContain("API key");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("maps a thrown error (e.g. PDF rendering) to SEND_FAILED", async () => {
    (renderToBuffer as jest.Mock).mockRejectedValue(new Error("font missing"));
    await expect(sendQuoteEmail({ id: 5 })).resolves.toMatchObject({ code: "SEND_FAILED" });
  });

  it("still reports success when recording the send fails", async () => {
    mockTransaction.mockRejectedValue(new Error("db down"));
    await expect(sendQuoteEmail({ id: 5 })).resolves.toEqual({ success: true });
    expect(console.error).toHaveBeenCalled();
  });

  it("rate-limits to 20 sends per hour per IP", async () => {
    for (let i = 0; i < 20; i++) {
      await expect(sendQuoteEmail({ id: 5 })).resolves.toEqual({ success: true });
    }
    const res = await sendQuoteEmail({ id: 5 });
    expect(res).toMatchObject({ success: false, code: "RATE_LIMITED" });
    if (!res.success && res.code === "RATE_LIMITED") expect(res.retryAfterMs).toBeGreaterThan(0);
    expect(mockSend).toHaveBeenCalledTimes(20);

    // another client is unaffected
    mockHeaders.mockResolvedValue(new Headers({ "x-forwarded-for": "192.168.1.1" }));
    await expect(sendQuoteEmail({ id: 5 })).resolves.toEqual({ success: true });
  });
});
