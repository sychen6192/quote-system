"use client";

import { useRef, useState, type ComponentProps, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { reloadForSignIn } from "./session";
import { downloadFile, saveBlob } from "./download";

export type DownloadLinkProps = Omit<ComponentProps<"a">, "href" | "download"> & {
  href: string;
  /** Used when the response names no file (Content-Disposition). */
  filename?: string;
};

/**
 * <a href download> that fetches first: an expired session goes to the
 * sign-in page and an error shows a toast, instead of the browser silently
 * cancelling a "pdf.json". Modified clicks (new tab, save link as…) keep the
 * browser's own behaviour. Works as an `asChild` child (props and ref pass
 * through to the <a>).
 */
export function DownloadLink({ href, filename, onClick, children, ...props }: DownloadLinkProps) {
  const t = useTranslations("Common");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const outcome = await downloadFile(
        href,
        { fetch: (input, init) => window.fetch(input, init), save: saveBlob },
        filename
      );
      if (outcome === "unauthorized") reloadForSignIn(t("sessionExpired"));
      else if (outcome === "failed") toast.error(t("downloadFailed"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <a
      {...props}
      href={href}
      download={filename ?? ""}
      aria-busy={busy || undefined}
      onClick={(event) => void handleClick(event)}
    >
      {children}
    </a>
  );
}
