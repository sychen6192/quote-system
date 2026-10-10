"use client";

import { Fragment, type ComponentProps, type FocusEvent, type ReactNode } from "react";
import type { ControllerRenderProps, FieldPath, FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";
import { moneyBreakParts, normalizeDecimalInput } from "./form-model";

/** 44px tall on phones (touch), the compact 36px from md up. */
export const fieldClass = "h-11 md:h-9";

/**
 * A formatted amount that stays on one line when it fits, and otherwise
 * wraps after a group separator ("NT$1,234,|567") instead of spilling into
 * the neighbouring column or being cut off.
 */
export function WrappingMoney({ value, className }: { value: string; className?: string }) {
  const parts = moneyBreakParts(value);
  return (
    <span className={cn("break-words tabular-nums", className)}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
    </span>
  );
}

/** Visual asterisk; the input itself carries aria-required. */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-destructive">
      *
    </span>
  );
}

/**
 * Input with an inline prefix/suffix (currency symbol, %). The adornments are
 * decorative: the label says what the number is.
 */
export function AdornedInput({
  prefix,
  suffix,
  className,
  inputClassName,
  children,
}: {
  prefix?: ReactNode;
  suffix?: ReactNode;
  className?: string;
  inputClassName?: string;
  children: (className: string) => ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      {prefix != null && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
        >
          {prefix}
        </span>
      )}
      {children(
        cn(
          "tabular-nums",
          prefix != null && "pl-8",
          suffix != null && "pr-8",
          inputClassName
        )
      )}
      {suffix != null && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

/**
 * One-tap preset (Invoify PaymentTermPresets pattern): aria-pressed shows
 * which preset the field currently matches. The visual chip is 32px; the
 * ::after hit area makes the touch target 44px tall.
 */
export function PresetChip({
  pressed,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "type"> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "relative inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors after:absolute after:inset-x-0 after:-inset-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        pressed
          ? "border-primary bg-primary/10 font-medium text-primary dark:bg-primary/20 dark:text-foreground"
          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Props for a number typed as text (inputMode="decimal": the numeric keypad
 * on phones, no spinner, no locale surprises). Full-width digits from a CJK
 * IME and grouping commas are normalised on blur, not while composing.
 */
export function decimalInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(field: ControllerRenderProps<TFieldValues, TName>) {
  return {
    name: field.name,
    ref: field.ref,
    value: (field.value ?? "") as string | number,
    onChange: field.onChange,
    onBlur: () => {
      if (typeof field.value === "string") {
        const normalized = normalizeDecimalInput(field.value);
        if (normalized !== field.value) field.onChange(normalized);
      }
      field.onBlur();
    },
    onFocus: (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select(),
    inputMode: "decimal" as const,
    autoComplete: "off",
    spellCheck: false,
  };
}
