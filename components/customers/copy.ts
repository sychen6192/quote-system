"use client";

import { toast } from "sonner";

/**
 * Copies text to the clipboard. navigator.clipboard only exists in secure
 * contexts, and self-hosted installs are often opened over plain-HTTP LAN
 * addresses, so fall back to the legacy execCommand path.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function copyWithToast(text: string, success: string, failure: string) {
  if (await copyText(text)) toast.success(success);
  else toast.error(failure);
}
