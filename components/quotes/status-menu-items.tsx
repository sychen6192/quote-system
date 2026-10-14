"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { QUOTE_STATUS_VALUES, isQuoteStatus, type QuoteStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import { StatusDot } from "./quote-status-badge";

/**
 * The four statuses as dropdown radio items, each with its colour and the
 * current one ticked at the end (a radio dot would sit beside the colour dot).
 */
export function StatusMenuItems({
  value,
  onChange,
  disabled,
  itemClassName,
}: {
  value: QuoteStatus;
  /** called with a status other than `value` */
  onChange: (next: QuoteStatus) => void;
  disabled?: boolean;
  itemClassName?: string;
}) {
  const t = useTranslations("Status");

  return (
    <DropdownMenuPrimitive.RadioGroup
      value={value}
      onValueChange={(next) => {
        if (isQuoteStatus(next) && next !== value) onChange(next);
      }}
    >
      {QUOTE_STATUS_VALUES.map((status) => (
        <DropdownMenuPrimitive.RadioItem
          key={status}
          value={status}
          disabled={disabled}
          className={cn(
            "relative flex cursor-pointer select-none items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            itemClassName
          )}
        >
          <StatusDot status={status} />
          <span className="flex-1">{t(status)}</span>
          <DropdownMenuPrimitive.ItemIndicator>
            <Check aria-hidden="true" className="size-4 text-primary" />
          </DropdownMenuPrimitive.ItemIndicator>
        </DropdownMenuPrimitive.RadioItem>
      ))}
    </DropdownMenuPrimitive.RadioGroup>
  );
}
