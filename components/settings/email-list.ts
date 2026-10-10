// CC-recipient chips (pure, client-safe).
import { isEmail, MAX_CC_EMAILS } from "@/lib/settings/schema";

/** Splits typed or pasted text ("a@x.tw, b@y.tw; c@z.tw") into addresses. */
export function splitEmails(text: string): string[] {
  return text
    .split(/[,;\s]+/)
    .map((part) => part.trim().replace(/^<|>$/g, ""))
    .filter(Boolean);
}

export type AddEmailsResult = {
  list: string[];
  /** entries that are not valid addresses (left in the input for fixing) */
  invalid: string[];
  /** valid entries not added because the list is full */
  overflow: string[];
};

/** Adds the valid, new addresses from `text` (case-insensitive de-duplication). */
export function addEmails(
  list: readonly string[],
  text: string,
  max: number = MAX_CC_EMAILS
): AddEmailsResult {
  const next = [...list];
  const seen = new Set(list.map((email) => email.toLowerCase()));
  const invalid: string[] = [];
  const overflow: string[] = [];
  for (const entry of splitEmails(text)) {
    if (!isEmail(entry)) {
      invalid.push(entry);
      continue;
    }
    const key = entry.toLowerCase();
    if (seen.has(key)) continue;
    if (next.length >= max) {
      overflow.push(entry);
      continue;
    }
    seen.add(key);
    next.push(entry);
  }
  return { list: next, invalid, overflow };
}
