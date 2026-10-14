import { formatIsoDate, formatPercent, initialOf } from "@/components/app-shell/format";
import { appDisplayName, brandDisplayName, shortAppName } from "@/components/app-shell/brand-name";
import { toQuoteRowView, urgencyOf } from "@/components/quotes/quote-row";
import { SETUP_ITEMS, setupProgress } from "@/components/dashboard/setup-state";

describe("formatIsoDate", () => {
  it("formats business dates without shifting the day", () => {
    expect(formatIsoDate("2026-10-09", "en")).toBe("Oct 9, 2026");
    expect(formatIsoDate("2026-10-09", "zh-TW")).toBe("2026/10/09");
    expect(formatIsoDate("2026-01-01T00:00:00.000Z", "en")).toBe("Jan 1, 2026");
  });

  it("has a full style with the weekday", () => {
    expect(formatIsoDate("2026-10-09", "en", "full")).toBe("Friday, October 9, 2026");
    expect(formatIsoDate("2026-10-09", "zh-TW", "full")).toBe("2026年10月9日 星期五");
  });

  it("returns an empty string for missing or invalid dates", () => {
    expect(formatIsoDate(null, "en")).toBe("");
    expect(formatIsoDate("2026-02-30", "en")).toBe("");
    expect(formatIsoDate("nope", "en")).toBe("");
  });
});

describe("formatPercent / initialOf", () => {
  it("rounds ratios to whole percents", () => {
    expect(formatPercent(2 / 3, "en")).toBe("67%");
    expect(formatPercent(0, "zh-TW")).toBe("0%");
  });

  it("takes the first character, CJK included", () => {
    expect(initialOf("宏達電子股份有限公司")).toBe("宏");
    expect(initialOf("  acme")).toBe("A");
    expect(initialOf("")).toBe("?");
    expect(initialOf(null)).toBe("?");
    expect(initialOf("😀 Smile")).toBe("😀");
  });
});

describe("brand names", () => {
  const base = { appName: "Quote System", companyName: "Your Company", companyNameLocal: "", isDefaultCompany: true };

  it("translates the built-in app name", () => {
    expect(appDisplayName(base, "報價系統")).toBe("報價系統");
    expect(appDisplayName({ ...base, appName: "  " }, "Quote System")).toBe("Quote System");
    expect(appDisplayName({ ...base, appName: "Acme Quotes" }, "報價系統")).toBe("Acme Quotes");
  });

  it("shows the company in the UI language once configured", () => {
    const company = {
      appName: "宏達電子",
      companyName: "HTC Electronics",
      companyNameLocal: "宏達電子",
      isDefaultCompany: false,
    };
    expect(brandDisplayName(company, "en", "Quote System")).toBe("HTC Electronics");
    expect(brandDisplayName(company, "zh-TW", "報價系統")).toBe("宏達電子");
    expect(brandDisplayName(base, "zh-TW", "報價系統")).toBe("報價系統");
  });
});

describe("shortAppName", () => {
  it("drops legal suffixes for the home-screen label", () => {
    expect(shortAppName("艾克米科技股份有限公司")).toBe("艾克米科技");
    expect(shortAppName("日昇貿易有限公司")).toBe("日昇貿易");
    expect(shortAppName("晨光設計工作室")).toBe("晨光設計");
    expect(shortAppName("Acme Inc.")).toBe("Acme");
    expect(shortAppName("Globex Co., Ltd.")).toBe("Globex");
    expect(shortAppName("Initech, LLC")).toBe("Initech");
    expect(shortAppName("Quote System")).toBe("Quote System");
    expect(shortAppName("有限公司")).toBe("有限公司");
  });
});

describe("quote row view", () => {
  const money = { currency: "TWD", currencyLocale: "zh-TW", fractionDigits: 0 };
  const row = {
    id: 7,
    quotationNumber: "QT-20261009-001",
    title: "  網路設備 ",
    salesperson: "李佳穎",
    issuedDate: "2026-10-09",
    validUntil: "2026-10-12",
    totalAmount: 31216500,
    status: "sent",
    displayStatus: "sent" as const,
    customer: { companyName: "宏達電子股份有限公司", contactPerson: "王志明" },
  };

  it("flags open quotes that end within 7 days", () => {
    expect(urgencyOf("sent", 0)).toBe("soon");
    expect(urgencyOf("draft", 7)).toBe("soon");
    expect(urgencyOf("draft", 8)).toBe("none");
    expect(urgencyOf("expired", -3)).toBe("expired");
    expect(urgencyOf("accepted", 2)).toBe("none");
    expect(urgencyOf("sent", null)).toBe("none");
  });

  it("formats money, dates and days left from the business 'today'", () => {
    const view = toQuoteRowView(row, { today: "2026-10-09", money, locale: "en" });
    expect(view).toMatchObject({
      id: 7,
      number: "QT-20261009-001",
      title: "網路設備",
      customerName: "宏達電子股份有限公司",
      contactPerson: "王志明",
      issuedLabel: "Oct 9, 2026",
      validUntilLabel: "Oct 12, 2026",
      status: "sent",
      savedStatus: "sent",
      daysLeft: 3,
      urgency: "soon",
    });
    expect(view.total).toBe(new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(312165));
  });

  it("has no days-left for decided quotes and tolerates missing parts", () => {
    const view = toQuoteRowView(
      { ...row, title: null, customer: null, status: "accepted", displayStatus: "accepted", issuedDate: null },
      { today: "2026-10-09", money, locale: "zh-TW" }
    );
    expect(view).toMatchObject({ title: null, customerName: null, daysLeft: null, urgency: "none", issuedLabel: "" });
    expect(view.savedStatus).toBe("accepted");
  });

  it("marks expired quotes", () => {
    const view = toQuoteRowView(
      { ...row, validUntil: "2026-10-01", displayStatus: "expired" },
      { today: "2026-10-09", money, locale: "en" }
    );
    // Still a sent quote underneath: that is what its status menu shows.
    expect(view).toMatchObject({ status: "expired", savedStatus: "sent", daysLeft: -8, urgency: "expired" });
  });
});

describe("setupProgress", () => {
  it("counts done items", () => {
    expect(SETUP_ITEMS.map((i) => i.key)).toEqual(["company", "logo", "firstQuote", "install"]);
    expect(setupProgress({ company: true, logo: false, firstQuote: true, install: false })).toEqual({
      done: 2,
      total: 4,
      complete: false,
    });
    expect(setupProgress({ company: true, logo: true, firstQuote: true, install: true }).complete).toBe(true);
  });
});
