import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { pagePath, requireSession } from "@/components/app-shell/require-session";
import { parseQuoteId } from "@/lib/schemas/quote";
import { routing } from "@/navigation";
import { loadQuote } from "./load-quote";

// The (detail) group scopes loading.tsx to this page, and the 404 is decided
// here, outside its Suspense boundary: a notFound() thrown in the page would
// stream the not-found UI with HTTP 200 (and /quotes/1.0 would look real).
// A loading.tsx directly in [id] would also wrap the edit page.
export const dynamic = "force-dynamic";

export default async function QuoteDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Signed out: to the sign-in page, not a 404 that would say whether the quote exists.
  await requireSession(locale, pagePath(locale, `/quotes/${encodeURIComponent(id)}`));
  const quoteId = parseQuoteId(id);
  if (quoteId === null || !(await loadQuote(quoteId))) notFound();
  return children;
}
