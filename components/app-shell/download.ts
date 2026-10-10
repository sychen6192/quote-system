// Downloads through fetch instead of a bare <a href download>: the API routes
// answer an expired session with 401 JSON, which a plain link turns into a
// silently cancelled "pdf.json". Pure apart from the injected fetch/save, so
// it is unit-tested directly.

/**
 * The file name from a Content-Disposition header: RFC 6266 `filename*`
 * (UTF-8, percent-encoded) first, then the plain `filename`; null if none.
 */
export function filenameFromDisposition(header: string | null | undefined): string | null {
  if (!header) return null;
  const extended = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (extended) {
    try {
      const name = decodeURIComponent(extended[2].trim().replace(/^"|"$/g, ""));
      if (name) return name;
    } catch {
      // Malformed encoding: fall back to the plain filename.
    }
  }
  const plain = /filename\s*=\s*("((?:\\.|[^"\\])*)"|[^;]+)/i.exec(header);
  if (!plain) return null;
  const name = (plain[2] !== undefined ? plain[2].replace(/\\(.)/g, "$1") : plain[1]).trim();
  return name || null;
}

/** The last path segment of `href`, as a fallback file name. */
function nameFromHref(href: string): string {
  try {
    const segment = new URL(href, "http://x").pathname.split("/").filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : "download";
  } catch {
    return "download";
  }
}

export type DownloadOutcome = "saved" | "unauthorized" | "failed";

export type DownloadDeps = {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** Hands the file to the browser (object URL + a temporary <a download>). */
  save: (blob: Blob, filename: string) => void;
};

/**
 * Fetches `href` and saves it. "unauthorized": the session expired (sign in
 * again); "failed": any other error status or a network failure.
 */
export async function downloadFile(
  href: string,
  deps: DownloadDeps,
  fallbackName?: string
): Promise<DownloadOutcome> {
  let response: Response;
  try {
    response = await deps.fetch(href, { credentials: "same-origin" });
  } catch {
    return "failed";
  }
  if (response.status === 401) return "unauthorized";
  if (!response.ok) return "failed";
  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    return "failed";
  }
  const filename =
    filenameFromDisposition(response.headers.get("content-disposition")) ??
    fallbackName ??
    nameFromHref(href);
  deps.save(blob, filename);
  return "saved";
}

/** Browser save: an object URL clicked through a temporary <a download>. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Long enough for the download to start, even on a slow device.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
