"use server";

import { normalizeSearchQuery } from "@/lib/search-query";
import { searchCustomerOptions, type CustomerOption } from "@/services/customers";
import { searchProductOptions, type ProductOption } from "@/services/products";
import { internalError, requireAuth, type ActionFailure } from "./types";

export type SearchResult<T> = { success: true; data: T[] } | ActionFailure;

const LIMIT = 8;

function normalizeQuery(q: unknown): string {
  return typeof q === "string" ? normalizeSearchQuery(q) : "";
}

async function search<T>(
  q: unknown,
  run: (term: string) => Promise<T[]>,
  label: string
): Promise<SearchResult<T>> {
  const denied = await requireAuth();
  if (denied) return denied;

  const term = normalizeQuery(q);
  if (term.length < 1) return { success: true, data: [] };
  try {
    return { success: true, data: await run(term) };
  } catch (error) {
    console.error(`${label} failed:`, error);
    return internalError(`${label} failed`);
  }
}

/** Company suggestions for the quote form's customer combobox. */
export async function searchCustomers(q: unknown): Promise<SearchResult<CustomerOption>> {
  return search(q, (term) => searchCustomerOptions(term, LIMIT), "searchCustomers");
}

/** Item suggestions from past quote lines. */
export async function searchProducts(q: unknown): Promise<SearchResult<ProductOption>> {
  return search(q, (term) => searchProductOptions(term, LIMIT), "searchProducts");
}
