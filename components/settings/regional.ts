// Currency, money-locale and time-zone options for the Settings page.
// Pure and client-safe; every Intl call degrades gracefully.

export const COMMON_CURRENCIES = [
  "TWD",
  "USD",
  "EUR",
  "JPY",
  "CNY",
  "HKD",
  "SGD",
  "GBP",
  "KRW",
  "AUD",
  "CAD",
  "MYR",
  "THB",
  "VND",
  "PHP",
  "IDR",
  "INR",
  "CHF",
  "NZD",
] as const;

export const COMMON_MONEY_LOCALES = [
  "zh-TW",
  "en-US",
  "en-GB",
  "ja-JP",
  "zh-CN",
  "zh-HK",
  "ko-KR",
  "en-SG",
  "de-DE",
  "fr-FR",
] as const;

/** "TWD" → "New Taiwan Dollar" in the UI language (the code when unknown). */
export function currencyName(code: string, uiLocale: string): string {
  try {
    return new Intl.DisplayNames([uiLocale], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** "zh-TW" → "Chinese (Taiwan)" in the UI language (the tag when unknown). */
export function localeName(tag: string, uiLocale: string): string {
  try {
    return new Intl.DisplayNames([uiLocale], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

// A representative subset for runtimes without Intl.supportedValuesOf.
const FALLBACK_ZONES = [
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Asia/Kolkata",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

/** Every IANA zone this runtime knows (plus UTC), sorted. */
export function listTimeZones(): string[] {
  let zones: string[] = FALLBACK_ZONES;
  try {
    if (typeof Intl.supportedValuesOf === "function") zones = Intl.supportedValuesOf("timeZone");
  } catch {
    // keep the fallback list
  }
  return [...new Set([...zones, "UTC"])].sort((a, b) => a.localeCompare(b));
}

/** "GMT+8" / "GMT-3:30" / "GMT" for `zone` at `date`; "" when unknown. */
export function timeZoneOffset(zone: string, date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** "America/Argentina/Buenos_Aires" → "Buenos Aires" */
export function timeZoneCity(zone: string): string {
  const last = zone.split("/").pop() ?? zone;
  return last.replace(/_/g, " ");
}

/** "Asia/Taipei" → "Asia" (zones without a region: ""). */
export function timeZoneRegion(zone: string): string {
  const parts = zone.split("/");
  return parts.length > 1 ? parts[0] : "";
}

function normalizeSearch(text: string): string {
  return text.toLowerCase().replace(/[_/\s]+/g, " ").trim();
}

/**
 * Zones matching `query` by name ("taipei", "new york", "asia/tok") or by
 * offset ("+8", "gmt+5:30"). Name prefixes rank first.
 */
export function filterTimeZones(
  zones: readonly string[],
  query: string,
  offsetOf: (zone: string) => string = (zone) => timeZoneOffset(zone)
): string[] {
  const q = normalizeSearch(query);
  if (!q) return [...zones];
  const offsetQuery = /^(?:gmt|utc)?\s*([+-]\d{1,2}(?::\d{2})?)$/.exec(q.replace(/\s+/g, ""));
  if (offsetQuery) {
    const wanted = offsetQuery[1].replace(/^([+-])0(\d)/, "$1$2");
    return zones.filter((zone) => {
      const offset = offsetOf(zone).replace(/^GMT/, "");
      return offset === wanted || (wanted.endsWith(":00") && offset === wanted.slice(0, -3));
    });
  }
  const starts: string[] = [];
  const contains: string[] = [];
  for (const zone of zones) {
    const name = normalizeSearch(zone);
    const city = normalizeSearch(timeZoneCity(zone));
    if (city.startsWith(q) || name.startsWith(q)) starts.push(zone);
    else if (name.includes(q)) contains.push(zone);
  }
  return [...starts, ...contains];
}

/** Current wall-clock time in `zone`, e.g. "14:05" (empty when unknown). */
export function timeInZone(zone: string, uiLocale: string, date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat(uiLocale, {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  } catch {
    return "";
  }
}
