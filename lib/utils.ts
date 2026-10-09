import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  BASIS_POINTS_PER_PERCENT,
  calculateQuoteFinancials as calculateFinancials,
  formatMoney,
  type MoneyItem,
} from "./money";

export { toBasisPoints, toPercentage } from "./money";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * @deprecated Use formatMoney from "@/lib/money". Kept for older call
 * sites; fraction digits now follow the currency (USD shows cents).
 */
export function formatCurrency(
  cents: number,
  money: { currency: string; currencyLocale: string; fractionDigits?: number }
) {
  return formatMoney(cents, money);
}

/** 1 % = 100 basis points */
export const TAX_RATE_SCALE = BASIS_POINTS_PER_PERCENT;

/**
 * @deprecated Use calculateQuoteFinancials from "@/lib/money" (discount and
 * other fees). This 2-argument form has neither.
 */
export function calculateQuoteFinancials(items: MoneyItem[], taxRateBP: number) {
  const totals = calculateFinancials(items, { taxRateBp: taxRateBP });
  return {
    subtotal: totals.subtotal,
    taxAmount: totals.tax,
    totalAmount: totals.total,
  };
}
