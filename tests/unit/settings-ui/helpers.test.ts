import { insertToken, previewPattern, tokenExample } from "@/components/settings/number-pattern";
import {
  filterTimeZones,
  listTimeZones,
  timeZoneCity,
  timeZoneOffset,
  timeZoneRegion,
} from "@/components/settings/regional";
import { addEmails, splitEmails } from "@/components/settings/email-list";
import {
  BRAND_PRESETS,
  brandPreviewVars,
  checkBrandingImage,
  normalizeHex,
  presetForHex,
} from "@/components/settings/branding-model";
import { MAX_BRANDING_BYTES } from "@/lib/settings/branding";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("number pattern help", () => {
  it("previews the first number of today", () => {
    expect(previewPattern("QT-{YYYY}{MM}{DD}-{SEQ:3}", "2026-10-09")).toEqual({
      ok: true,
      example: "QT-20261009-001",
    });
    expect(previewPattern("Q{ROC}{MM}-{SEQ}", "2026-10-09")).toEqual({
      ok: true,
      example: "Q11510-1",
    });
  });

  it("reports why a pattern is invalid", () => {
    expect(previewPattern("QT-{YYYY}", "2026-10-09")).toEqual({ ok: false, error: "NO_SEQ" });
    expect(previewPattern("{SEQ}{SEQ:2}", "2026-10-09")).toEqual({ ok: false, error: "MULTIPLE_SEQ" });
    expect(previewPattern("{FOO}{SEQ}", "2026-10-09")).toEqual({ ok: false, error: "UNKNOWN_TOKEN" });
    expect(previewPattern("  ", "2026-10-09")).toEqual({ ok: false, error: "EMPTY" });
  });

  it("explains each token with today's value", () => {
    expect(tokenExample("{YYYY}", "2026-10-09")).toBe("2026");
    expect(tokenExample("{YY}", "2026-10-09")).toBe("26");
    expect(tokenExample("{ROC}", "2026-10-09")).toBe("115");
    expect(tokenExample("{MM}", "2026-10-09")).toBe("10");
    expect(tokenExample("{DD}", "2026-10-09")).toBe("09");
    expect(tokenExample("{SEQ:3}", "2026-10-09")).toBe("001");
  });

  it("inserts a token at the caret or over the selection", () => {
    expect(insertToken("QT--", "{YYYY}", 3, 3)).toEqual({ value: "QT-{YYYY}-", caret: 9 });
    expect(insertToken("QT-XX", "{MM}", 3, 5)).toEqual({ value: "QT-{MM}", caret: 7 });
    expect(insertToken("QT-", "{DD}", null, null)).toEqual({ value: "QT-{DD}", caret: 7 });
  });

  it("keeps a single sequence token", () => {
    // Existing {SEQ} before the caret is removed and the caret shifts left.
    expect(insertToken("{SEQ}-QT-", "{SEQ:3}", 9, 9)).toEqual({ value: "-QT-{SEQ:3}", caret: 11 });
    // Existing {SEQ:2} after the caret.
    expect(insertToken("QT-{SEQ:2}", "{SEQ:3}", 3, 3)).toEqual({ value: "QT-{SEQ:3}", caret: 10 });
    // The selected sequence token is replaced in place.
    expect(insertToken("QT-{SEQ}", "{SEQ:3}", 3, 8)).toEqual({ value: "QT-{SEQ:3}", caret: 10 });
  });
});

describe("time zones", () => {
  it("lists IANA zones including UTC", () => {
    const zones = listTimeZones();
    expect(zones).toContain("Asia/Taipei");
    expect(zones).toContain("UTC");
    expect([...zones].sort((a, b) => a.localeCompare(b))).toEqual(zones);
  });

  it("formats offsets", () => {
    const july = new Date("2026-07-01T00:00:00Z");
    expect(timeZoneOffset("Asia/Taipei", july)).toBe("GMT+8");
    expect(timeZoneOffset("Asia/Kolkata", july)).toBe("GMT+5:30");
    expect(timeZoneOffset("Not/AZone", july)).toBe("");
  });

  it("splits city and region", () => {
    expect(timeZoneCity("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
    expect(timeZoneRegion("Asia/Taipei")).toBe("Asia");
    expect(timeZoneRegion("UTC")).toBe("");
  });

  const zones = ["America/New_York", "Asia/Taipei", "Asia/Tokyo", "Europe/London", "UTC"];
  const offsets: Record<string, string> = {
    "America/New_York": "GMT-4",
    "Asia/Taipei": "GMT+8",
    "Asia/Tokyo": "GMT+9",
    "Europe/London": "GMT+1",
    UTC: "GMT",
  };
  const offsetOf = (zone: string) => offsets[zone];

  it("filters by city, path and offset", () => {
    expect(filterTimeZones(zones, "", offsetOf)).toEqual(zones);
    expect(filterTimeZones(zones, "taip", offsetOf)).toEqual(["Asia/Taipei"]);
    expect(filterTimeZones(zones, "new york", offsetOf)).toEqual(["America/New_York"]);
    expect(filterTimeZones(zones, "new_york", offsetOf)).toEqual(["America/New_York"]);
    expect(filterTimeZones(zones, "asia/to", offsetOf)).toEqual(["Asia/Tokyo"]);
    // City prefixes rank before other substring matches.
    expect(filterTimeZones(zones, "u", offsetOf)).toEqual(["UTC", "Europe/London"]);
    expect(filterTimeZones(zones, "+8", offsetOf)).toEqual(["Asia/Taipei"]);
    expect(filterTimeZones(zones, "GMT+08:00", offsetOf)).toEqual(["Asia/Taipei"]);
    expect(filterTimeZones(zones, "utc-4", offsetOf)).toEqual(["America/New_York"]);
  });
});

describe("CC emails", () => {
  it("splits pasted lists", () => {
    expect(splitEmails(" a@x.tw, b@y.tw;c@z.tw  <d@w.tw>")).toEqual([
      "a@x.tw",
      "b@y.tw",
      "c@z.tw",
      "d@w.tw",
    ]);
  });

  it("adds valid, new addresses up to the limit", () => {
    expect(addEmails(["a@x.tw"], "A@x.tw, b@y.tw, nope", 3)).toEqual({
      list: ["a@x.tw", "b@y.tw"],
      invalid: ["nope"],
      overflow: [],
    });
    expect(addEmails(["a@x.tw", "b@y.tw"], "c@z.tw d@w.tw", 3)).toEqual({
      list: ["a@x.tw", "b@y.tw", "c@z.tw"],
      invalid: [],
      overflow: ["d@w.tw"],
    });
  });
});

describe("brand colour", () => {
  it("normalises hex input", () => {
    expect(normalizeHex("1d4ed8")).toBe("#1D4ED8");
    expect(normalizeHex(" #0f766e ")).toBe("#0F766E");
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("blue")).toBeNull();
  });

  it("recognises presets", () => {
    expect(presetForHex("#1e3a8a")).toBe("navy");
    expect(presetForHex("#123456")).toBeNull();
    expect(new Set(BRAND_PRESETS.map((p) => p.hex)).size).toBe(BRAND_PRESETS.length);
  });

  it("builds preview tokens, including for the default colour", () => {
    expect(brandPreviewVars("#1D4ED8", "light")).toMatchObject({ "--primary": "224 76% 48%" });
    expect(brandPreviewVars("#1D4ED8", "dark")).toMatchObject({ "--primary": "217 91% 62%" });
    const teal = brandPreviewVars("#0F766E", "light");
    expect(teal?.["--primary"]).toMatch(/^\d+ \d+% \d+%$/);
    expect(Object.keys(teal ?? {})).toEqual(
      expect.arrayContaining(["--primary", "--primary-foreground", "--ring", "--accent"])
    );
    expect(brandPreviewVars("nope", "light")).toBeNull();
  });
});

describe("checkBrandingImage", () => {
  it("accepts PNGs and warns about non-square or small icons", () => {
    expect(checkBrandingImage("logo", png(1200, 400))).toEqual({
      ok: true,
      width: 1200,
      height: 400,
      warnings: [],
    });
    expect(checkBrandingImage("icon", png(400, 300))).toEqual({
      ok: true,
      width: 400,
      height: 300,
      warnings: ["notSquare", "small"],
    });
  });

  it("rejects what the upload action would reject", () => {
    expect(checkBrandingImage("logo", new TextEncoder().encode("GIF89a..."))).toEqual({
      ok: false,
      error: "unsupportedImage",
    });
    expect(checkBrandingImage("stamp", png(4000, 4000))).toEqual({
      ok: false,
      error: "imageDimensionsTooLarge",
    });
    const big = new Uint8Array(MAX_BRANDING_BYTES + 1);
    big.set(png(10, 10));
    expect(checkBrandingImage("logo", big)).toEqual({ ok: false, error: "imageTooLarge" });
  });
});
