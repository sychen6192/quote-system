import { renderToStaticMarkup } from "react-dom/server";
import {
  amountInWords,
  documentMoney,
  formatAmount,
  formatTotal,
  type DocumentMoney,
} from "@/components/quote-document/format";
import { QuoteDocument } from "@/components/quote-document/quote-document";
import { formTotals } from "@/components/quote-form/form-model";
import { minorUnitStep } from "@/lib/money";
import { pdfDocumentLabels } from "@/lib/pdf/labels";
import { quoteViewFromForm, type QuoteView } from "@/lib/quote-view";
import type { QuoteFormValues } from "@/lib/schemas/quote";
import type { DocumentBranding } from "@/lib/settings/types";

const TWD: DocumentMoney = { currency: "TWD", currencyLocale: "zh-TW", fractionDigits: 0 };

const base = {
  companyName: "宏達電子",
  issuedDate: "2026-10-09",
  validUntil: "2026-11-08",
  taxRate: 5,
} satisfies Partial<QuoteFormValues>;

const item = (quantity: number, unitPrice: number) => ({
  productName: "x",
  description: "",
  unit: "",
  quantity,
  unitPrice,
  isTaxable: true,
});

const CASES: { name: string; values: Partial<QuoteFormValues> }[] = [
  { name: "3 × NT$10.50 at 5% tax", values: { ...base, items: [item(1, 10.5), item(1, 10.5), item(1, 10.5)] } },
  {
    name: "NT$1,000 with a 1.25% discount and 5% tax",
    values: { ...base, discountType: "percent", discountValue: 1.25, items: [item(1, 1000)] },
  },
  { name: "2 × (1.5 × NT$15)", values: { ...base, items: [item(1.5, 15), item(1.5, 15)] } },
  {
    name: "fees with cents",
    values: { ...base, otherFees: 99.5, discountType: "amount", discountValue: 0.4, items: [item(3, 33.33)] },
  },
];

/** "NT$1,036" / "1,036" / "-13" → 103600 / 103600 / -1300 cents. */
function parseShown(text: string): number {
  const negative = /^[-−]/.test(text.trim());
  const number = Number(text.replace(/[^\d.]/g, ""));
  return Math.round(number * 100) * (negative ? -1 : 1);
}

function shown(view: QuoteView, money: DocumentMoney) {
  return {
    lines: view.items.map((line) => parseShown(formatAmount(line.amount, money))),
    subtotal: parseShown(formatAmount(view.totals.subtotal, money)),
    discount: parseShown(formatAmount(view.totals.discount, money)),
    tax: parseShown(formatAmount(view.totals.tax, money)),
    fees: parseShown(formatAmount(view.totals.otherFees, money)),
    total: parseShown(formatTotal(view.totals.total, money)),
  };
}

function expectAddsUp(view: QuoteView, money: DocumentMoney) {
  const figures = shown(view, money);
  expect(figures.lines.reduce((sum, cents) => sum + cents, 0)).toBe(figures.subtotal);
  expect(figures.subtotal - figures.discount + figures.tax + figures.fees).toBe(figures.total);
  // The amount in words is the printed total, not the unrounded one.
  expect(amountInWords(view.totals.total, money, "en")).toBe(amountInWords(figures.total, money, "en"));
  expect(amountInWords(view.totals.total, money, "zh-TW")).toBe(
    amountInWords(figures.total, money, "zh-TW")
  );
}

describe("printed figures add up for a currency without cents (TWD)", () => {
  it.each(CASES)("$name: rounded to whole NT$ like the saved quote", ({ values }) => {
    const view = quoteViewFromForm(values, { today: "2026-10-09", minorUnitStep: minorUnitStep(0) });
    const money = documentMoney(view, TWD);
    expect(money.fractionDigits).toBe(0);
    expectAddsUp(view, money);
  });

  // A view computed without the currency's step (an older caller) still
  // prints consistent figures: with cents, rather than each rounded alone.
  it.each(CASES)("$name: unrounded figures switch the whole document to cents", ({ values }) => {
    const view = quoteViewFromForm(values, { today: "2026-10-09" });
    const money = documentMoney(view, TWD);
    expectAddsUp(view, money);
  });

  it("keeps the currency's digits when nothing is hidden", () => {
    const view = quoteViewFromForm({ ...base, items: [item(2, 100)] }, { today: "2026-10-09" });
    expect(documentMoney(view, TWD)).toBe(TWD);
    const usd = { currency: "USD", currencyLocale: "en-US", fractionDigits: 2 };
    expect(documentMoney(view, usd)).toBe(usd);
  });

  it("the editor's live totals match the document's", () => {
    for (const { values } of CASES) {
      const view = quoteViewFromForm(values, { today: "2026-10-09", minorUnitStep: 100 });
      expect(formTotals(values, { minorUnitStep: 100 })).toEqual(view.totals);
    }
  });
});

describe("QuoteDocument", () => {
  const branding: DocumentBranding = {
    company: { name: "Acme Ltd", nameLocal: "", address: "", vatNumber: "", email: "", phone: "", website: "", isDefault: false },
    payment: null,
    logoSrc: "",
    stampSrc: null,
    brandColor: "#1D4ED8",
    currency: "TWD",
    currencyLocale: "zh-TW",
    fractionDigits: 0,
    showAmountInWords: true,
    footerText: "",
    timezone: "Asia/Taipei",
  };

  it("prints 3 × NT$10.50 as figures that add up", () => {
    const view = quoteViewFromForm(CASES[0].values, { today: "2026-10-09", minorUnitStep: 100 });
    const out = renderToStaticMarkup(
      <QuoteDocument view={view} branding={branding} labels={pdfDocumentLabels("en")} locale="en" />
    );
    const text = out.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    // 11 + 11 + 11 = 33; 5% tax 2; total 35 — never "subtotal 32, total 33".
    expect(view.items.map((line) => line.amount)).toEqual([1100, 1100, 1100]);
    expect(view.totals).toMatchObject({ subtotal: 3300, tax: 200, total: 3500 });
    expect(text).toContain("33");
    expect(text).toMatch(/\$35\b/);
    expect(text).not.toMatch(/\$33\b/);
  });
});
