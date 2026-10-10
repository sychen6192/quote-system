import { contentDisposition, quotePdfFilename } from "@/lib/pdf/filename";

describe("quotePdfFilename", () => {
  it.each<[string, string]>([
    ["QT-20261009-001", "Quote-QT-20261009-001.pdf"],
    ["A/B:C*D?E\"F<G>H|I", "Quote-A_B_C_D_E_F_G_H_I.pdf"],
    ["QT\r\n1", "Quote-QT__1.pdf"],
    ["報價-115-001", "Quote-報價-115-001.pdf"],
  ])("%p → %p", (number, expected) => {
    expect(quotePdfFilename(number)).toBe(expected);
  });
});

describe("contentDisposition", () => {
  it("uses a plain filename for ASCII names", () => {
    expect(contentDisposition("inline", "Quote-QT-1.pdf")).toBe('inline; filename="Quote-QT-1.pdf"');
    expect(contentDisposition("attachment", "Quote-QT-1.pdf")).toBe(
      'attachment; filename="Quote-QT-1.pdf"'
    );
  });

  it("adds an RFC 5987 filename* for non-ASCII names", () => {
    expect(contentDisposition("attachment", "Quote-報價-001.pdf")).toBe(
      "attachment; filename=\"Quote-__-001.pdf\"; filename*=UTF-8''Quote-%E5%A0%B1%E5%83%B9-001.pdf"
    );
  });

  it("escapes characters that are not RFC 5987 attr-chars", () => {
    const header = contentDisposition("inline", "Quote (draft)'s 報價.pdf");
    expect(header).toContain("filename*=UTF-8''Quote%20%28draft%29%27s%20%E5%A0%B1%E5%83%B9.pdf");
    expect(header).toContain('filename="Quote (draft)\'s __.pdf"');
  });

  it("never lets a quote or backslash break out of the quoted filename", () => {
    expect(contentDisposition("inline", 'a"b\\c.pdf')).toBe('inline; filename="a_b_c.pdf"; filename*=UTF-8\'\'a%22b%5Cc.pdf');
  });
});
