import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { pagePath, requireSession } from "@/components/app-shell/require-session";
import { parseQuoteId } from "@/lib/schemas/quote";
import { routing } from "@/navigation";
import { loadQuote } from "./load-quote";

// Resolved outside loading.tsx's Suspense boundary: a notFound() thrown in
// the page would stream the 404 UI with HTTP 200 (and /quotes/1.0/edit would
// look like a real page to crawlers and monitors).
export const dynamic = "force-dynamic";

export default async function EditQuoteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Signed out: to the sign-in page, not a 404 that would say whether the quote exists.
  await requireSession(locale, pagePath(locale, `/quotes/${encodeURIComponent(id)}/edit`));
  const quoteId = parseQuoteId(id);
  if (quoteId === null || !(await loadQuote(quoteId))) notFound();
  return children;
}
