// Rough text measurements for react-pdf boxes whose height must be known
// before layout (the fixed footer reserves its space on every page). Pure.

// CJK, Hangul and full-width forms are one em wide in Noto Sans TC; other
// characters average a little over half an em, so 0.6 errs on the wide side.
const WIDE_RE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{20000}-\u{3fffd}]/u;
const NARROW_EM = 0.6;

/** Approximate rendered width of one line of text, in ems. */
export function textWidthEm(text: string): number {
  let width = 0;
  for (const char of text) width += WIDE_RE.test(char) ? 1 : NARROW_EM;
  return width;
}

/** Lines `text` wraps to in a box `lineWidthEm` ems wide (each "\n" starts a line); 0 for "". */
export function estimateLineCount(text: string, lineWidthEm: number): number {
  if (!text || !(lineWidthEm > 0)) return 0;
  return text
    .split(/\r?\n/)
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(textWidthEm(line) / lineWidthEm)), 0);
}
