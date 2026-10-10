import * as fs from "node:fs";
import * as path from "node:path";
import { quoteEmailLabels, quoteEmailSubject } from "@/components/emails/labels";
import { quoteEmailProps } from "@/components/emails/quote-email-props";
import type { QuoteView } from "@/lib/quote-view";
import type { DocumentBranding } from "@/lib/settings/types";

const ROOT = path.join(__dirname, "../../..");

function view(overrides: Partial<QuoteView> = {}): QuoteView {
  return {
    id: 1,
    quotationNumber: "QT-20261009-001",
    title: null,
    status: "sent",
    displayStatus: "sent",
    issuedDate: "2026-10-09",
    validUntil: "2026-11-08",
    salesperson: "陳志明",
    customer: { companyName: "宏達電子股份有限公司", contactPerson: null, email: null, phone: null, address: null, vatNumber: null },
    items: [],
    taxRate: 5,
    discount: { type: "amount", value: 0 },
    totals: { subtotal: 100000, taxableSubtotal: 100000, discount: 0, taxBase: 100000, tax: 5000, otherFees: 0, total: 105000 },
    paymentTerms: null,
    deliveryMethod: null,
    deliveryDate: null,
    notes: null,
    terms: null,
    ...overrides,
  };
}

const branding: DocumentBranding = {
  company: { name: "Acme Ltd", nameLocal: "艾克米有限公司", address: "", vatNumber: "", email: "office@acme.test", phone: "", website: "", isDefault: false },
  payment: { bankName: "台灣銀行", bankCode: "004", accountName: "", accountNumber: "1234" },
  logoSrc: "data:image/png;base64,AAAA",
  stampSrc: null,
  brandColor: "#1D4ED8",
  currency: "TWD",
  currencyLocale: "zh-TW",
  fractionDigits: 0,
  showAmountInWords: true,
  footerText: "  ",
  timezone: "Asia/Taipei",
};

describe("Email messages", () => {
  it("have the same keys in both locales", () => {
    const keys = (locale: string) =>
      Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, `messages/${locale}/Email.json`), "utf8"))).sort();
    expect(keys("zh-TW")).toEqual(keys("en"));
  });
});

describe("quoteEmailSubject", () => {
  it("is localised", () => {
    expect(quoteEmailSubject("zh-TW", "QT-1", "艾克米有限公司")).toBe("報價單 QT-1 — 艾克米有限公司");
    expect(quoteEmailSubject("en", "QT-1", "Acme Ltd")).toBe("Quotation QT-1 from Acme Ltd");
  });

  it("never contains a line break (header injection)", () => {
    expect(quoteEmailSubject("en", "QT-1", "Acme\r\nBcc: x@y")).toBe("Quotation QT-1 from Acme Bcc: x@y");
  });
});

describe("quoteEmailProps", () => {
  it("pre-formats the quote in the email's language", () => {
    const props = quoteEmailProps({ view: view(), branding, lang: "zh-TW", message: "  ", attachmentName: "報價單-QT-1.pdf" });
    expect(props.labels).toBe(quoteEmailLabels("zh-TW"));
    expect(props.company.name).toBe("艾克米有限公司");
    expect(props.company.altName).toBe("Acme Ltd");
    expect(props.quote).toEqual({
      number: "QT-20261009-001",
      title: null,
      validUntil: "2026/11/08",
      total: "$1,050",
      recipientName: "宏達電子股份有限公司",
    });
    expect(props.message).toBeNull();
    expect(props.footerText).toBeNull();
    expect(props.payment).toEqual([
      { label: "銀行", value: "台灣銀行" },
      { label: "銀行代碼", value: "004" },
      { label: "帳號", value: "1234" },
    ]);
  });

  it("greets the contact person and uses the English company name in English", () => {
    const props = quoteEmailProps({
      view: view({ customer: { ...view().customer, contactPerson: "Jane" } }),
      branding: { ...branding, payment: null },
      lang: "en",
      message: "Hello",
      attachmentName: "Quotation-QT-1.pdf",
    });
    expect(props.company.name).toBe("Acme Ltd");
    expect(props.quote.recipientName).toBe("Jane");
    expect(props.quote.validUntil).toBe("Nov 8, 2026");
    expect(props.message).toBe("Hello");
    expect(props.payment).toEqual([]);
  });
});
