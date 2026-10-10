// Adapted from Invoify (https://github.com/al1abb/invoify), MIT License, Copyright (c) 2023 Ali Abbasov.
//
// Small in-memory LRU of rendered quote PDFs. Rendering takes a few hundred
// ms (CJK font subsetting) and people open, download and share the same
// quote in a row. Per process and unshared: an optimisation, not a store.
import "server-only";
import { createHash } from "node:crypto";

export const PDF_CACHE_MAX_ENTRIES = 8;
/** A PDF with large embedded logo/stamp images is not small. */
export const PDF_CACHE_MAX_BYTES = 16 * 1024 * 1024;

type Pdf = Uint8Array<ArrayBuffer>;
type Entry = { key: string; pdf: Pdf };

// Oldest first; short enough that splice/shift is fine.
let entries: Entry[] = [];
let totalBytes = 0;

export type PdfCacheKeyParts = {
  id: number;
  /** quotations.updated_at: bumped by every edit, status change and send */
  updatedAt: Date | string | null;
  lang: string;
  /** settings.version: company details, branding and money format */
  version: string;
  /** business-timezone date: the document shows whether the quote has expired */
  today: string;
};

export function pdfCacheKey({ id, updatedAt, lang, version, today }: PdfCacheKeyParts): string {
  const stamp = updatedAt instanceof Date ? updatedAt.toISOString() : (updatedAt ?? "");
  return createHash("sha256")
    .update([id, stamp, lang, version, today].join("|"))
    .digest("hex");
}

export function getCachedPdf(key: string): Pdf | null {
  const index = entries.findIndex((entry) => entry.key === key);
  if (index === -1) return null;
  // Move to the end: the least recently used entry is evicted first.
  const [entry] = entries.splice(index, 1);
  entries.push(entry);
  return entry.pdf;
}

export function setCachedPdf(key: string, pdf: Pdf): void {
  // A single oversized PDF must not evict the whole cache to store itself.
  if (pdf.byteLength > PDF_CACHE_MAX_BYTES) return;

  entries = entries.filter((entry) => {
    if (entry.key !== key) return true;
    totalBytes -= entry.pdf.byteLength;
    return false;
  });

  entries.push({ key, pdf });
  totalBytes += pdf.byteLength;

  while (entries.length > PDF_CACHE_MAX_ENTRIES || totalBytes > PDF_CACHE_MAX_BYTES) {
    const evicted = entries.shift();
    if (!evicted) break;
    totalBytes -= evicted.pdf.byteLength;
  }
}

/** Test seam. */
export function clearPdfCache(): void {
  entries = [];
  totalBytes = 0;
}

/** Test seam. */
export function pdfCacheStats(): { entries: number; bytes: number } {
  return { entries: entries.length, bytes: totalBytes };
}
