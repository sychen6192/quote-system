// Per-<Text> line-break callback for the quote PDF. Pure.
//
// The registered callback (lib/pdf/line-break) never breaks inside a Latin
// run, so a long part number, hash or URL query wider than its column is
// drawn straight over the neighbouring cells. Runs longer than any real
// word may break between any two characters instead, without a hyphen (an
// empty syllable is a zero-width break point).
import { pdfLineBreakSyllables } from "@/lib/pdf/line-break";

/** Longer than any dictionary word, shorter than a typical SKU or hash. */
export const LONG_RUN_CHARS = 24;

export function pdfWrapSyllables(word: string): string[] {
  const out: string[] = [];
  for (const syllable of pdfLineBreakSyllables(word)) {
    const chars = Array.from(syllable);
    if (chars.length <= LONG_RUN_CHARS) {
      out.push(syllable);
      continue;
    }
    chars.forEach((char, index) => {
      if (index > 0) out.push("");
      out.push(char);
    });
  }
  return out;
}
