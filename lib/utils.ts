import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(amount / 100); // 假設輸入是分 (Cents)
}

// 定義 Basis Points 比例：1% = 100 BP
export const TAX_RATE_SCALE = 100;

/**
 * 將百分比轉為 Basis Points (存入 DB 用)
 * 例如: 5 (%) -> 500
 */
export function toBasisPoints(percent: number): number {
  return Math.round(percent * TAX_RATE_SCALE);
}

/**
 * 將 Basis Points 轉為百分比 (前端顯示用)
 * 例如: 500 -> 5 (%)
 */
export function toPercentage(bp: number): number {
  return bp / TAX_RATE_SCALE;
}

/**
 * 集中化的金額計算邏輯
 * @param items 商品列表 (unitPrice 單位: 分)
 * @param taxRateBP 稅率 (單位: Basis Points, e.g., 500)
 */
export function calculateQuoteFinancials(
  items: { quantity: number; unitPrice: number }[],
  taxRateBP: number
) {
  // 1. 計算小計 (Subtotal)
  const subtotal = items.reduce((acc, item) => {
    return acc + (item.quantity * item.unitPrice);
  }, 0);

  // 2. 計算稅額 (Tax Amount)
  // 公式: 金額 * (BP / 10000)
  // 例如: 100元 * (500 / 10000) = 5元
  const taxAmount = Math.round(subtotal * (taxRateBP / (100 * TAX_RATE_SCALE)));

  // 3. 計算總額 (Total)
  const totalAmount = subtotal + taxAmount;

  return { subtotal, taxAmount, totalAmount };
}