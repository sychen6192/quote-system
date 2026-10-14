// Presentation model for quote rows (list, dashboard). Built on the server so
// money, dates and urgency come from the business settings and timezone.

import { daysUntil, isIsoDate, toIsoDate } from "@/lib/dates";
import { formatMoney, type MoneyFormat } from "@/lib/money";
import { normalizeStatus, type DisplayStatus, type QuoteStatus } from "@/lib/status";
import { formatIsoDate } from "@/components/app-shell/format";

/** How close the valid-until date is, for open quotes only. */
export type Urgency = "expired" | "soon" | "none";

export type QuoteRowView = {
  id: number;
  number: string;
  title: string | null;
  customerName: string | null;
  contactPerson: string | null;
  salesperson: string;
  issuedLabel: string;
  validUntilLabel: string;
  status: DisplayStatus;
  /** the saved status; `status` reads "expired" instead for open quotes past valid-until */
  savedStatus: QuoteStatus;
  total: string;
  /** days from today to valid-until (negative once passed); null for decided quotes */
  daysLeft: number | null;
  urgency: Urgency;
};

export const EXPIRING_SOON_DAYS = 7;

type QuoteRowSource = {
  id: number;
  quotationNumber: string;
  title?: string | null;
  salesperson?: string | null;
  issuedDate?: string | Date | null;
  validUntil: string | Date;
  totalAmount: number;
  status: string | null;
  displayStatus: DisplayStatus;
  customer?: { companyName?: string | null; contactPerson?: string | null } | null;
};

export function urgencyOf(status: DisplayStatus, daysLeft: number | null): Urgency {
  if (status === "expired") return "expired";
  if ((status === "draft" || status === "sent") && daysLeft !== null && daysLeft >= 0) {
    return daysLeft <= EXPIRING_SOON_DAYS ? "soon" : "none";
  }
  return "none";
}

export function toQuoteRowView(
  row: QuoteRowSource,
  { today, money, locale }: { today: string; money: MoneyFormat; locale: string }
): QuoteRowView {
  const validUntil = toIsoDate(row.validUntil);
  const open = row.displayStatus === "draft" || row.displayStatus === "sent" || row.displayStatus === "expired";
  const daysLeft = open && validUntil && isIsoDate(today) ? daysUntil(validUntil, today) : null;
  return {
    id: row.id,
    number: row.quotationNumber,
    title: row.title?.trim() || null,
    customerName: row.customer?.companyName?.trim() || null,
    contactPerson: row.customer?.contactPerson?.trim() || null,
    salesperson: row.salesperson?.trim() ?? "",
    issuedLabel: formatIsoDate(toIsoDate(row.issuedDate ?? null), locale),
    validUntilLabel: formatIsoDate(validUntil, locale),
    status: row.displayStatus,
    savedStatus: normalizeStatus(row.status),
    total: formatMoney(row.totalAmount, money),
    daysLeft,
    urgency: urgencyOf(row.displayStatus, daysLeft),
  };
}
