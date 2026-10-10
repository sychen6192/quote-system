import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { parseQuoteId } from "@/lib/schemas/quote";
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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quoteId = parseQuoteId(id);
  if (quoteId === null || !(await loadQuote(quoteId))) notFound();
  return children;
}
