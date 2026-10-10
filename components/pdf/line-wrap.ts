// Per-<Text> line-break callback for the quote PDF. Pure.
//
// The registered callback (lib/pdf/line-break) already lets a Latin run
// longer than any real word break between characters, but only where the
// kinsoku rules allow: a run with no legal break at all (dot leaders
// "........", "……", "%%%%") would still be drawn straight over the
// neighbouring cells. As a last resort such a run may break between any two
// characters, without a hyphen (an empty syllable is a zero-width break
// point). Everything else is exactly what the registered callback returns.
import { LONG_RUN_CHARS, pdfLineBreakSyllables } from "@/lib/pdf/line-break";

export { LONG_RUN_CHARS };

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
