import "server-only";
import { cache } from "react";
import { assertAuthenticated } from "@/lib/auth/guard";
import { getQuoteById } from "@/services/quotes";

/**
 * One query per request, shared by the layout, generateMetadata and the page.
 * Fails closed for a signed-out request (callers check the session first and
 * redirect to sign-in).
 */
export const loadQuote = cache(async (id: number) => {
  await assertAuthenticated();
  return getQuoteById(id);
});
