import "server-only";
import { cache } from "react";
import { getQuoteById } from "@/services/quotes";

/** One query per request, shared by the layout, generateMetadata and the page. */
export const loadQuote = cache((id: number) => getQuoteById(id));
