"use server";

import { normalizeSearchQuery } from "@/lib/search-query";
import {
  recentCustomerOptions,
  searchCustomerOptions,
  type CustomerOption,
} from "@/services/customers";
import {
  recentProductOptions,
  searchProductOptions,
  type ProductOption,
} from "@/services/products";
import { internalError, requireAuth, type ActionFailure } from "./types";

export type SearchResult<T> = { success: true; data: T[] } | ActionFailure;

const LIMIT = 8;

function normalizeQuery(q: unknown): string {
  return typeof q === "string" ? normalizeSearchQuery(q) : "";
}

/** `browse` answers an empty query (nothing typed yet); without it, no results. */
async function search<T>(
  q: unknown,
  run: (term: string) => Promise<T[]>,
  label: string,
  browse?: () => Promise<T[]>
): Promise<SearchResult<T>> {
  const denied = await requireAuth();
  if (denied) return denied;

  const term = normalizeQuery(q);
  const query = term ? () => run(term) : browse;
  if (!query) return { success: true, data: [] };
  try {
    return { success: true, data: await query() };
  } catch (error) {
    console.error(`${label} failed:`, error);
    return internalError(`${label} failed`);
  }
}

/**
 * Company suggestions for the quote form's customer combobox; with nothing
 * typed, the customers quoted most recently.
 */
export async function searchCustomers(q: unknown): Promise<SearchResult<CustomerOption>> {
  return search(
    q,
    (term) => searchCustomerOptions(term, LIMIT),
    "searchCustomers",
    () => recentCustomerOptions(LIMIT)
  );
}

/** Item suggestions from past quote lines; with nothing typed, the ones used most recently. */
export async function searchProducts(q: unknown): Promise<SearchResult<ProductOption>> {
  return search(
    q,
    (term) => searchProductOptions(term, LIMIT),
    "searchProducts",
    () => recentProductOptions(LIMIT)
  );
}
