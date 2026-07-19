import type { ReactNode } from "react";
import { Link } from "@/navigation";
import { StatusBadge } from "./quote-status-badge";

export type QuoteCardItem = {
  id: number;
  quotationNumber: string;
  customerName: string;
  dateLabel: string;
  amountLabel: string;
  status: string | null;
  validUntil?: Date | string | null;
};

/**
 * Mobile presentation for quote lists. Tables squeeze CJK customer names into
 * one-character-wide columns below ~768px, so small screens get stacked cards
 * instead and the table is hidden.
 */
export function QuoteCards({
  items,
  renderActions,
}: {
  items: QuoteCardItem[];
  renderActions?: (item: QuoteCardItem) => ReactNode;
}) {
  return (
    <ul className="divide-y md:hidden">
      {items.map((item) => (
        <li key={item.id} className="p-4">
          <Link href={`/quotes/${item.id}`} className="block space-y-2">
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold text-primary">
                {item.quotationNumber}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {item.amountLabel}
              </span>
            </div>
            <div className="font-medium">{item.customerName}</div>
            <div className="flex items-center justify-between gap-3">
              <StatusBadge status={item.status} validUntil={item.validUntil} />
              <span className="text-xs text-muted-foreground">
                {item.dateLabel}
              </span>
            </div>
          </Link>
          {renderActions && (
            <div className="mt-3 flex justify-end gap-1">
              {renderActions(item)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
