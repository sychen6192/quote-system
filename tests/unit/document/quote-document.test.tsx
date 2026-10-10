import { renderToStaticMarkup } from "react-dom/server";
import { QuoteDocument } from "@/components/quote-document/quote-document";
import { pdfDocumentLabels } from "@/lib/pdf/labels";
import { quoteViewFromForm } from "@/lib/quote-view";
import type { DocumentBranding } from "@/lib/settings/types";

const branding: DocumentBranding = {
  company: { name: "Acme Ltd", nameLocal: "艾克米有限公司", address: "台北市", vatNumber: "24536806", email: "", phone: "02-1234", website: "", isDefault: false },
  payment: null,
  logoSrc: "/api/branding/logo?v=1",
  stampSrc: null,
  brandColor: "#1D4ED8",
  currency: "TWD",
  currencyLocale: "zh-TW",
  fractionDigits: 0,
  showAmountInWords: true,
  footerText: "",
  timezone: "Asia/Taipei",
};

const view = quoteViewFromForm(
  {
    companyName: "宏達電子",
    contactPerson: "",
    issuedDate: "2026-10-09",
    validUntil: "2026-11-08",
    taxRate: 5,
    discountType: "percent",
    discountValue: 10,
    items: [
      { productName: "設計", description: "首頁\n內頁", unit: "式", quantity: 1.5, unitPrice: 1000, isTaxable: false },
    ],
    notes: "備註",
  },
  { today: "2026-10-09", quotationNumber: "QT-1" }
);

const html = (interactive: boolean) =>
  renderToStaticMarkup(
    <QuoteDocument
      view={view}
      branding={branding}
      labels={pdfDocumentLabels("zh-TW")}
      locale="zh-TW"
      interactive={interactive}
      onEditField={() => {}}
    />
  );

describe("QuoteDocument", () => {
  it("renders the quote with filled-in labels", () => {
    const out = html(false);
    expect(out).toContain("報價單");
    expect(out).toContain("QT-1");
    expect(out).toContain("1.5");
    expect(out).toContain("免稅");
    expect(out).toContain("折扣（10%）");
    expect(out).toContain("營業稅（5%）");
    expect(out).toContain("新台幣");
    expect(out).not.toContain("{rate}");
    // only when there is a contact person
    expect(out).not.toContain("聯絡人");
  });

  it("is not interactive on the detail page", () => {
    const out = html(false);
    expect(out).not.toContain("data-edit-field");
    expect(out).not.toContain('role="button"');
  });

  it("marks editable regions in the live preview, reachable by keyboard", () => {
    const out = html(true);
    for (const field of ["customer.companyName", "issuedDate", "validUntil", "items.0.productName", "items.0.description", "items.0.quantity", "items.0.unitPrice", "items.0.isTaxable", "totals.discount", "notes"]) {
      expect(out).toMatch(new RegExp(`data-edit-field="${field.replace(/\./g, "\\.")}" role="button" tabindex="0"`));
    }
  });
});
