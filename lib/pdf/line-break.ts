// Line-break opportunities for react-pdf, which splits text into "words" on
// spaces only and then asks a hyphenation callback for break points:
// - its default English hyphenator never splits a run of CJK text (which has
//   no spaces), so a Chinese paragraph overflows its box on one line;
// - returning one syllable per character makes it break, but react-pdf then
//   appends "-" to every broken line, as if it had hyphenated a word.
// An empty syllable becomes a zero-width glue node: a break point with no
// hyphen. So CJK characters are separated by "" (respecting the basic
// kinsoku rules for punctuation), and Latin words are never hyphenated,
// which would mangle emails, model numbers and quote numbers.
// A Latin run longer than any real word (a SKU, hash or URL) would be drawn
// straight past its box, so it may break between any two characters, again
// without a hyphen. This callback is registered for every PDF <Text>.

const CJK_RE =
  /[⺀-⿿　-〿぀-ヿ㄀-ㇿ㈀-㏿㐀-䶿一-鿿ꥠ-꥿가-힯豈-﫿︰-﹏＀-￯]|[\u{20000}-\u{3134F}]/u;

// A line must not start with these…
const NO_BREAK_BEFORE = new Set(
  Array.from("、。，．：；？！）」』】〕〉》｝］〗〙〛〞‐–—～〜・…‥ー々ゝゞヽヾぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ％,.:;?!)]}%")
);
// …or end with these.
const NO_BREAK_AFTER = new Set(Array.from("（「『【〔〈《｛［〖〘〚〝([{＄￥$"));

const isCjk = (char: string) => CJK_RE.test(char);

/** Longer than any dictionary word, shorter than a typical SKU or hash. */
export const LONG_RUN_CHARS = 24;

const canBreakBetween = (before: string, after: string) =>
  !NO_BREAK_BEFORE.has(after) && !NO_BREAK_AFTER.has(before);

/** A long run as single characters (kinsoku pairs kept together) with "" between. */
function splitLongRun(segment: string): string[] {
  const chars = Array.from(segment);
  if (chars.length <= LONG_RUN_CHARS) return [segment];
  const out: string[] = [];
  let current = chars[0];
  for (let i = 1; i < chars.length; i++) {
    if (canBreakBetween(chars[i - 1], chars[i])) {
      out.push(current, "");
      current = chars[i];
    } else {
      current += chars[i];
    }
  }
  out.push(current);
  return out;
}

/** Break after "-" or "/" when a letter follows (not in "QT-001" or "1/2"). */
function latinUnits(run: string): string[] {
  const units: string[] = [];
  let current = "";
  const chars = Array.from(run);
  chars.forEach((char, i) => {
    current += char;
    const next = chars[i + 1];
    if ((char === "-" || char === "/") && next && /\p{L}/u.test(next) && current.length > 1) {
      units.push(current);
      current = "";
    }
  });
  if (current) units.push(current);
  return units;
}

/**
 * Splits one space-free "word" into syllables for
 * Font.registerHyphenationCallback. Joining the result gives back `word`.
 */
export function pdfLineBreakSyllables(word: string): string[] {
  if (!word) return [word];

  const units: string[] = [];
  let latin = "";
  for (const char of Array.from(word)) {
    if (isCjk(char)) {
      if (latin) units.push(...latinUnits(latin));
      latin = "";
      units.push(char);
    } else {
      latin += char;
    }
  }
  if (latin) units.push(...latinUnits(latin));

  const syllables: string[] = [];
  let segment = units[0];
  for (let i = 1; i < units.length; i++) {
    const prev = units[i - 1];
    const unit = units[i];
    const prevLast = Array.from(prev).pop() ?? "";
    const first = Array.from(unit)[0];
    const breakable =
      (isCjk(prevLast) || isCjk(first) || /[-/]$/.test(prev)) && canBreakBetween(prevLast, first);
    if (breakable) {
      syllables.push(...splitLongRun(segment), "");
      segment = unit;
    } else {
      segment += unit;
    }
  }
  syllables.push(...splitLongRun(segment));
  return syllables;
}
