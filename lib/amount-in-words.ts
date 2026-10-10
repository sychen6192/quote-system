// Amount in words for quote totals (spec §4).
//
// zh-TW uses the formal 大寫 numerals written on Taiwanese cheques and
// contracts. Convention: 拾 is ALWAYS preceded by a digit (10 元 → 壹拾元整,
// 100000 元 → 壹拾萬元整, never 拾萬), the way banks require it on cheques
// so nothing can be prepended to the amount. Runs of zeros inside the number
// collapse to a single 零 (10005 → 壹萬零伍), and trailing zeros are dropped.
// 整 closes amounts that stop at 元 or 角; amounts with 分 have no 整.

const ZH_DIGITS = ["零", "壹", "貳", "參", "肆", "伍", "陸", "柒", "捌", "玖"];
const ZH_POSITIONS = ["", "拾", "佰", "仟"];
const ZH_GROUPS = ["", "萬", "億", "兆", "京"];

/** 0–9999 without leading zeros; inner zero runs become one 零. */
function zhGroup(value: number): string {
  let out = "";
  let zeroPending = false;
  for (let pos = 3; pos >= 0; pos--) {
    const digit = Math.floor(value / 10 ** pos) % 10;
    if (digit === 0) {
      if (out) zeroPending = true;
      continue;
    }
    if (zeroPending) {
      out += ZH_DIGITS[0];
      zeroPending = false;
    }
    out += ZH_DIGITS[digit] + ZH_POSITIONS[pos];
  }
  return out;
}

function zhInteger(value: number): string {
  if (value === 0) return ZH_DIGITS[0];
  const groups: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 10_000)) {
    groups.push(rest % 10_000);
  }
  let out = "";
  let zeroPending = false;
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (group === 0) {
      if (out) zeroPending = true;
      continue;
    }
    // A zero group, or a group below 1000 after a higher group, reads 零.
    if (out && (zeroPending || group < 1000)) out += ZH_DIGITS[0];
    out += zhGroup(group) + ZH_GROUPS[i];
    zeroPending = false;
  }
  return out;
}

function normaliseCents(cents: number): { negative: boolean; abs: number } {
  const value = Number.isFinite(cents) ? Math.round(cents) : 0;
  return { negative: value < 0, abs: Math.abs(value) };
}

/**
 * 123400 → "新台幣壹仟貳佰參拾肆元整"; 123456 → "新台幣壹仟貳佰參拾肆元伍角陸分".
 * Pass `prefix: ""` for currencies other than TWD.
 */
export function amountInWordsZhTW(
  cents: number,
  { prefix = "新台幣" }: { prefix?: string } = {}
): string {
  const { negative, abs } = normaliseCents(cents);
  const yuan = Math.floor(abs / 100);
  const jiao = Math.floor((abs % 100) / 10);
  const fen = abs % 10;

  let words = "";
  if (yuan > 0 || (jiao === 0 && fen === 0)) {
    words += zhInteger(yuan) + "元";
  }
  if (jiao > 0) {
    words += ZH_DIGITS[jiao] + "角";
  } else if (fen > 0 && yuan > 0) {
    words += ZH_DIGITS[0];
  }
  if (fen > 0) {
    words += ZH_DIGITS[fen] + "分";
  } else {
    words += "整";
  }
  return `${prefix}${negative ? "負" : ""}${words}`;
}

const EN_ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const EN_TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
const EN_SCALES = ["", "thousand", "million", "billion", "trillion", "quadrillion"];

function enBelowThousand(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) parts.push(`${EN_ONES[hundreds]} hundred`);
  if (rest >= 20) {
    const unit = rest % 10;
    parts.push(EN_TENS[Math.floor(rest / 10)] + (unit ? `-${EN_ONES[unit]}` : ""));
  } else if (rest > 0) {
    parts.push(EN_ONES[rest]);
  }
  return parts.join(" ");
}

function enInteger(value: number): string {
  if (value === 0) return EN_ONES[0];
  const parts: string[] = [];
  let scale = 0;
  for (let rest = value; rest > 0; rest = Math.floor(rest / 1000), scale++) {
    const chunk = rest % 1000;
    if (chunk) {
      parts.unshift(
        enBelowThousand(chunk) + (EN_SCALES[scale] ? ` ${EN_SCALES[scale]}` : "")
      );
    }
  }
  return parts.join(" ");
}

/**
 * Simple cheque-style fallback: 123456 → "One thousand two hundred
 * thirty-four and 56/100 only".
 */
export function amountInWordsEn(cents: number): string {
  const { negative, abs } = normaliseCents(cents);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  let words = enInteger(major);
  if (minor > 0) words += ` and ${String(minor).padStart(2, "0")}/100`;
  words = `${negative ? "minus " : ""}${words} only`;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
