"use client";

import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { CustomerOption } from "@/services/customers";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: CustomerOption) => void;
  options: CustomerOption[];
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export function CompanyCombobox({
  value,
  onChange,
  onSelect,
  options,
  disabled,
  placeholder,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter(
        (o) =>
          o.companyName.toLowerCase().includes(q) ||
          (o.vatNumber ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [value, options]);

  const showList = open && matches.length > 0;

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // delay so a click on an option registers before the list closes
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {showList && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {matches.map((o, i) => (
            <li key={`${o.companyName}-${i}`}>
              <button
                type="button"
                className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  // prevent the input's blur from firing before the click
                  e.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  onSelect(o);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{o.companyName}</span>
                {(o.vatNumber || o.contactPerson) && (
                  <span className="text-xs text-muted-foreground">
                    {[o.vatNumber, o.contactPerson].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
