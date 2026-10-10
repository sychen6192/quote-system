import { localizedPdfDisposition, localizedPdfFilename } from "@/lib/pdf/labels";

describe("localizedPdfFilename", () => {
  it.each<[string, "en" | "zh-TW", string]>([
    ["QT-20261009-001", "zh-TW", "報價單-QT-20261009-001.pdf"],
    ["QT-20261009-001", "en", "Quotation-QT-20261009-001.pdf"],
    [" QT-1 ", "en", "Quotation-QT-1.pdf"],
    ['A/B:C*D?E"F<G>H|I', "en", "Quotation-A_B_C_D_E_F_G_H_I.pdf"],
    ["QT\r\n1", "zh-TW", "報價單-QT__1.pdf"],
  ])("%p (%s) → %p", (number, lang, expected) => {
    expect(localizedPdfFilename(number, lang)).toBe(expected);
  });
});

describe("localizedPdfDisposition", () => {
  it("uses a plain filename for English names", () => {
    expect(localizedPdfDisposition("attachment", "QT-1", "en")).toBe(
      'attachment; filename="Quotation-QT-1.pdf"'
    );
  });

  it("adds filename* for Chinese names, with the English name as the fallback", () => {
    expect(localizedPdfDisposition("inline", "QT-1", "zh-TW")).toBe(
      "inline; filename=\"Quotation-QT-1.pdf\"; filename*=UTF-8''%E5%A0%B1%E5%83%B9%E5%96%AE-QT-1.pdf"
    );
  });

  it("keeps a non-ASCII quote number readable in both parameters", () => {
    const header = localizedPdfDisposition("attachment", "報價-001", "en");
    expect(header).toBe(
      "attachment; filename=\"Quotation-__-001.pdf\"; filename*=UTF-8''Quotation-%E5%A0%B1%E5%83%B9-001.pdf"
    );
    expect(header).not.toMatch(/[\r\n]/);
  });
});
