// Download names for quote PDFs. Pure.

/** "Quote-QT-20261009-001.pdf" (same name as the email attachment). */
export function quotePdfFilename(quotationNumber: string): string {
  return `Quote-${quotationNumber.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_")}.pdf`;
}

// RFC 5987 attr-char: ALPHA / DIGIT / "!#$&+-.^_`|~"; everything else is %XX.
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Content-Disposition with an ASCII `filename` for old clients and, when the
 * name is not plain ASCII (custom number patterns may contain 報價), an
 * RFC 6266 / 5987 `filename*=UTF-8''…` that modern browsers prefer.
 */
export function contentDisposition(type: "inline" | "attachment", filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  if (ascii === filename) return `${type}; filename="${ascii}"`;
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
}
