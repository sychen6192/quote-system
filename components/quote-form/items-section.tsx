// Adapted from Invoify (https://github.com/al1abb/invoify), MIT License, Copyright (c) 2023 Ali Abbasov.
// (SingleItem: one card per line on a phone, a grid row when the container is
// wide; up/down reorder as the keyboard alternative to drag.)
"use client";

import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
  type FieldPath,
} from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  MoreHorizontal,
  Package,
  Plus,
  Text,
  Trash2,
  X,
} from "lucide-react";
import { searchProducts } from "@/actions/search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field-error";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ACTION_TOAST_DURATION_MS } from "@/components/ui/toast-layer";
import { fromCents, lineAmount, toCents } from "@/lib/money";
import type { QuoteFormValues, QuoteItemFormValues } from "@/lib/schemas/quote";
import { cn } from "@/lib/utils";
import type { ProductOption } from "@/services/products";
import { AsyncCombobox, Highlight } from "./async-combobox";
import { useEditor, useMoney, useRevealListener, useSubmittingListener } from "./editor-context";
import { AdornedInput, RequiredMark, WrappingMoney, decimalInputProps, fieldClass } from "./field-bits";
import { emptyItem, lenientNumber, trailingBlankItemIndexes } from "./form-model";

type RowActions = {
  moveUp(index: number): void;
  moveDown(index: number): void;
  duplicate(index: number): void;
  remove(index: number): void;
  /** Enter in a price field: next row, or a new one after the last. */
  next(index: number): void;
};

// Three shapes from the container width (not the viewport): a stacked card on
// a phone, a compact card when there is room for unit/qty/price side by side,
// and a single table-like row (with the description underneath) when wide.
const ROW_GRID = cn(
  "grid grid-cols-2 gap-x-3 gap-y-3",
  "[grid-template-areas:'num_menu'_'name_name'_'desc_desc'_'unit_qty'_'price_price'_'tax_amount']",
  "@lg:grid-cols-4 @lg:[grid-template-areas:'num_num_num_menu'_'name_name_name_name'_'desc_desc_desc_desc'_'unit_qty_price_price'_'tax_tax_amount_amount']",
  "@[40rem]:grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_5rem_7.5rem_7rem_2.25rem] @[40rem]:gap-x-2 @[40rem]:gap-y-1",
  "@[40rem]:[grid-template-areas:'num_name_unit_qty_price_amount_menu'_'._desc_desc_desc_desc_tax_.']"
);

export function ItemsSection() {
  const t = useTranslations("QuoteForm");
  const form = useFormContext<QuoteFormValues>();
  const { fields, append, insert, remove, move } = useFieldArray({
    control: form.control,
    name: "items",
  });
  const unitsListId = useId();
  const units = t("items.units")
    .split(",")
    .map((unit) => unit.trim())
    .filter(Boolean);
  const count = fields.length;

  // Save drops untouched rows at the end (Enter in the last price adds one),
  // so they don't block saving with "required" on fields nobody filled in.
  useSubmittingListener(() => {
    const blank = trailingBlankItemIndexes(form.getValues("items"));
    if (blank.length) remove(blank);
  });

  const focusName = useCallback(
    (index: number) =>
      requestAnimationFrame(() =>
        form.setFocus(`items.${index}.productName`, { shouldSelect: true })
      ),
    [form]
  );

  const add = () => {
    // react-hook-form >= 7.81 re-validates the list after append while it has
    // a list-wide error (totalTooLarge, a server error), which would flag the
    // new blank row "required" at once and hide that error. Save shows it
    // again if it still applies.
    form.clearErrors("items.root" as FieldPath<QuoteFormValues>);
    append(emptyItem(), { shouldFocus: false });
    focusName(count);
  };

  const actions: RowActions = {
    moveUp: (index) => index > 0 && move(index, index - 1),
    moveDown: (index) => index < count - 1 && move(index, index + 1),
    duplicate: (index) => {
      const copy = structuredClone(form.getValues(`items.${index}`)) as QuoteItemFormValues;
      insert(index + 1, copy, { shouldFocus: false });
      focusName(index + 1);
    },
    remove: (index) => {
      if (count <= 1) return;
      const removed = structuredClone(form.getValues(`items.${index}`)) as QuoteItemFormValues;
      remove(index);
      focusName(Math.min(index, count - 2));
      toast(t("items.removed"), {
        description: removed.productName ? String(removed.productName) : undefined,
        action: {
          label: t("items.undo"),
          onClick: () => insert(index, removed, { shouldFocus: false }),
        },
        duration: ACTION_TOAST_DURATION_MS,
      });
    },
    next: (index) => {
      if (index >= count - 1) add();
      else focusName(index + 1);
    },
  };

  return (
    <div className="@container">
      <datalist id={unitsListId}>
        {units.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>

      <div
        aria-hidden="true"
        className={cn(
          ROW_GRID,
          "hidden border-b pb-2 text-xs font-medium text-muted-foreground @[40rem]:grid"
        )}
      >
        <span className="[grid-area:num]">#</span>
        <span className="[grid-area:name]">{t("fields.productName")}</span>
        <span className="[grid-area:unit]">{t("fields.unit")}</span>
        <span className="text-right [grid-area:qty]">{t("fields.quantity")}</span>
        <span className="text-right [grid-area:price]">{t("fields.unitPrice")}</span>
        <span className="text-right [grid-area:amount]">{t("fields.amount")}</span>
      </div>

      <ol className="space-y-3 @[40rem]:space-y-0 @[40rem]:divide-y">
        {fields.map((field, index) => (
          <ItemRow
            key={field.id}
            index={index}
            count={count}
            unitsListId={unitsListId}
            actions={actions}
          />
        ))}
      </ol>

      <ItemsRootError />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 @[40rem]:mt-3">
        <Button type="button" variant="outline" onClick={add} className="h-11 md:h-9">
          <Plus aria-hidden="true" />
          {t("items.add")}
        </Button>
        <p className="hidden text-xs text-muted-foreground md:block">{t("hints.items")}</p>
      </div>
    </div>
  );
}

function ItemsRootError() {
  const tv = useTranslations("Validation");
  const { errors } = useFormState<QuoteFormValues>({ name: "items" });
  const message = errors.items?.root?.message ?? errors.items?.message;
  if (!message) return null;
  return (
    <FieldError data-form-error="" className="mt-3">
      {tv.has(message) ? tv(message) : message}
    </FieldError>
  );
}

function ItemRow({
  index,
  count,
  unitsListId,
  actions,
}: {
  index: number;
  count: number;
  unitsListId: string;
  actions: RowActions;
}) {
  const t = useTranslations("QuoteForm");
  const form = useFormContext<QuoteFormValues>();
  const money = useMoney();
  const { onSessionExpired, submitting } = useEditor();
  const n = index + 1;
  const suffix = <span className="sr-only">{t("items.labelSuffix", { n })}</span>;
  const [showDescription, setShowDescription] = useState(
    () => String(form.getValues(`items.${index}.description`) ?? "").trim() !== ""
  );
  const keepMenuFocus = useRef(true);

  useRevealListener((path) => {
    if (path === `items.${index}.description`) setShowDescription(true);
  });

  const set = <K extends keyof QuoteItemFormValues>(key: K, value: QuoteItemFormValues[K]) =>
    form.setValue(`items.${index}.${key}` as `items.${number}.${K}`, value as never, {
      shouldDirty: true,
      shouldValidate: true,
    });

  const pickProduct = (option: ProductOption) => {
    set("productName", option.productName);
    if (option.description) {
      set("description", option.description);
      setShowDescription(true);
    }
    if (option.unit) set("unit", option.unit);
    set("unitPrice", fromCents(option.unitPrice));
    set("isTaxable", option.isTaxable);
    requestAnimationFrame(() =>
      form.setFocus(`items.${index}.quantity`, { shouldSelect: true })
    );
  };

  const onPriceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    actions.next(index);
  };

  const menuAction = (run: () => void, moveFocus = false) => () => {
    keepMenuFocus.current = !moveFocus;
    run();
  };

  return (
    <li
      className={cn(
        ROW_GRID,
        "rounded-lg border bg-muted/30 p-3 dark:bg-background/40 @[40rem]:rounded-none @[40rem]:border-0 @[40rem]:bg-transparent @[40rem]:dark:bg-transparent @[40rem]:px-0 @[40rem]:py-3"
      )}
    >
      <div className="flex min-h-9 items-center gap-2 [grid-area:num] @[40rem]:min-h-9 @[40rem]:items-start @[40rem]:pt-2">
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary @[40rem]:size-auto @[40rem]:bg-transparent @[40rem]:text-sm @[40rem]:font-medium @[40rem]:text-muted-foreground"
        >
          {n}
        </span>
        <span className="text-sm font-medium @[40rem]:sr-only">{t("items.item", { n })}</span>
      </div>

      <FormField
        control={form.control}
        name={`items.${index}.productName`}
        render={({ field }) => (
          <FormItem className="min-w-0 [grid-area:name]">
            <FormLabel className="@[40rem]:sr-only">
              {t("fields.productName")}
              {suffix}
              <RequiredMark />
            </FormLabel>
            <FormControl>
              <AsyncCombobox<ProductOption>
                ref={field.ref}
                name={field.name}
                value={String(field.value ?? "")}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                onPick={pickProduct}
                search={searchProducts}
                minChars={0}
                getKey={(option) => option.productName.toLowerCase()}
                onSessionError={onSessionExpired}
                cancelOn={submitting}
                aria-required="true"
                placeholder={t("placeholders.productName")}
                className={fieldClass}
                popupClassName="sm:right-auto sm:w-[max(100%,24rem)]"
                labels={{
                  searching: t("combobox.searching"),
                  empty: t("combobox.noProducts"),
                  error: t("combobox.error"),
                  offline: t("combobox.offline"),
                  results: (resultCount) => t("combobox.results", { count: resultCount }),
                  listbox: t("combobox.products"),
                  browse: {
                    title: t("combobox.recentProducts"),
                    empty: t("combobox.noRecentProducts"),
                    toggle: t("combobox.showProducts"),
                  },
                }}
                renderOption={(option, query) => (
                  <>
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <Package aria-hidden="true" className="size-3.5 shrink-0 self-center text-muted-foreground" />
                        <span className="truncate">
                          <Highlight text={option.productName} query={query} />
                        </span>
                      </span>
                      <span className="money shrink-0 text-xs text-muted-foreground">
                        {money.format(option.unitPrice)}
                        {option.unit ? ` / ${option.unit}` : ""}
                      </span>
                    </span>
                    {option.description && (
                      <span className="truncate pl-[1.375rem] text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </>
                )}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="min-w-0 [grid-area:desc]">
        {showDescription ? (
          <FormField
            control={form.control}
            name={`items.${index}.description`}
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <FormLabel className="text-xs text-muted-foreground">
                    {t("fields.description")}
                    {suffix}
                  </FormLabel>
                  <button
                    type="button"
                    onClick={() => {
                      set("description", "");
                      setShowDescription(false);
                    }}
                    className="relative -my-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground after:absolute after:-inset-x-1 after:-inset-y-2.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                    {t("items.removeDescription")}
                  </button>
                </div>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    rows={2}
                    placeholder={t("placeholders.description")}
                    className="min-h-[3.75rem] resize-y bg-background [field-sizing:content]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowDescription(true);
              requestAnimationFrame(() => form.setFocus(`items.${index}.description`));
            }}
            className="-ml-2 h-11 px-2 text-primary hover:text-primary md:h-8"
          >
            <Text aria-hidden="true" />
            {t("items.addDescription")}
            {suffix}
          </Button>
        )}
      </div>

      <FormField
        control={form.control}
        name={`items.${index}.unit`}
        render={({ field }) => (
          <FormItem className="min-w-0 [grid-area:unit]">
            <FormLabel className="@[40rem]:sr-only">
              {t("fields.unit")}
              {suffix}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                list={unitsListId}
                maxLength={20}
                autoComplete="off"
                placeholder={t("placeholders.unit")}
                className={cn(fieldClass, "bg-background")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={`items.${index}.quantity`}
        render={({ field }) => (
          <FormItem className="min-w-0 [grid-area:qty]">
            <FormLabel className="@[40rem]:sr-only">
              {t("fields.quantity")}
              {suffix}
              <RequiredMark />
            </FormLabel>
            <FormControl>
              <Input
                {...decimalInputProps(field)}
                aria-required="true"
                className={cn(fieldClass, "bg-background tabular-nums @[40rem]:text-right")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={`items.${index}.unitPrice`}
        render={({ field }) => (
          <FormItem className="min-w-0 [grid-area:price]">
            <FormLabel className="@[40rem]:sr-only">
              {t("fields.unitPrice")}
              {suffix}
              <RequiredMark />
            </FormLabel>
            <AdornedInput prefix={money.symbol}>
              {(adorned) => (
                <FormControl>
                  <Input
                    {...decimalInputProps(field)}
                    aria-required="true"
                    enterKeyHint={index === count - 1 ? "done" : "next"}
                    onKeyDown={onPriceKeyDown}
                    className={cn(fieldClass, adorned, "bg-background @[40rem]:text-right")}
                  />
                </FormControl>
              )}
            </AdornedInput>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={`items.${index}.isTaxable`}
        render={({ field }) => (
          <FormItem className="flex min-h-11 items-center gap-2 space-y-0 [grid-area:tax] md:min-h-8 @[40rem]:justify-self-end">
            <FormControl>
              <Switch
                ref={field.ref}
                name={field.name}
                checked={field.value ?? true}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
                // 44px-tall touch target around the 20px track.
                className="relative after:absolute after:-inset-x-1 after:-inset-y-3"
              />
            </FormControl>
            <FormLabel className="cursor-pointer text-sm font-normal text-muted-foreground">
              {t("fields.taxable")}
              {suffix}
            </FormLabel>
          </FormItem>
        )}
      />

      <div className="flex min-h-11 min-w-0 flex-wrap items-center justify-end gap-x-2 text-right [grid-area:amount] md:min-h-8 @[40rem]:min-h-9 @[40rem]:items-start @[40rem]:pt-2">
        <span className="text-sm text-muted-foreground @[40rem]:sr-only">{t("fields.amount")}</span>
        <LineAmount index={index} />
      </div>

      <div className="justify-self-end [grid-area:menu]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("items.menu", { n })}
              className="size-11 text-muted-foreground md:size-9"
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-44"
            onCloseAutoFocus={(event) => {
              if (!keepMenuFocus.current) event.preventDefault();
              keepMenuFocus.current = true;
            }}
          >
            <DropdownMenuItem disabled={index === 0} onSelect={menuAction(() => actions.moveUp(index))}>
              <ArrowUp aria-hidden="true" />
              {t("items.moveUp")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === count - 1}
              onSelect={menuAction(() => actions.moveDown(index))}
            >
              <ArrowDown aria-hidden="true" />
              {t("items.moveDown")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={menuAction(() => actions.duplicate(index), true)}>
              <Copy aria-hidden="true" />
              {t("items.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={count <= 1}
              onSelect={menuAction(() => actions.remove(index), true)}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 aria-hidden="true" />
              {t("items.remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

/** Own useWatch, so typing in one line re-renders only this figure. */
function LineAmount({ index }: { index: number }) {
  const money = useMoney();
  const [quantity, unitPrice] = useWatch<QuoteFormValues>({
    name: [`items.${index}.quantity`, `items.${index}.unitPrice`],
  }) as [unknown, unknown];
  const amount = lineAmount(lenientNumber(quantity), toCents(lenientNumber(unitPrice)), money.step);
  return <WrappingMoney value={money.format(amount)} className="min-w-0 text-sm font-semibold" />;
}
