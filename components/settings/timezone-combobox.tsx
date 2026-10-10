"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Clock, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import {
  filterTimeZones,
  listTimeZones,
  timeInZone,
  timeZoneCity,
  timeZoneOffset,
} from "./regional";

type Props = {
  value: string;
  onChange: (zone: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/** Searchable IANA time-zone picker (ARIA combobox + listbox in a popover). */
export const TimeZoneCombobox = forwardRef<HTMLButtonElement, Props>(function TimeZoneCombobox(
  { value, onChange, onBlur, id, name, ...aria },
  ref
) {
  const t = useTranslations("Settings.regional");
  const locale = useLocale();
  const mounted = useMounted();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const zones = useMemo(() => (open ? listTimeZones() : []), [open]);
  // One formatter per zone is slow-ish (~400 zones): only while open.
  const offsets = useMemo(() => {
    const map = new Map<string, string>();
    const now = new Date();
    for (const zone of zones) map.set(zone, timeZoneOffset(zone, now));
    return map;
  }, [zones]);
  const results = useMemo(
    () => filterTimeZones(zones, query, (zone) => offsets.get(zone) ?? ""),
    [zones, query, offsets]
  );

  useEffect(() => {
    if (!open) return;
    // Scroll the list only (scrollIntoView could also move the page).
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (!list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 4;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 4;
  }, [activeIndex, open]);

  const choose = (zone: string) => {
    onChange(zone);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(0, results.length - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const zone = results[activeIndex];
      if (zone) choose(zone);
    }
  };

  const offset = mounted ? timeZoneOffset(value) : "";
  const time = mounted ? timeInZone(value, locale) : "";
  const activeId = results[activeIndex] ? `${listId}-${activeIndex}` : undefined;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          // Start on the current zone.
          setActiveIndex(Math.max(0, listTimeZones().indexOf(value)));
        } else {
          setQuery("");
          onBlur?.();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={ref}
          id={id}
          name={name}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-describedby={aria["aria-describedby"]}
          aria-invalid={aria["aria-invalid"]}
          className="flex h-11 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-sm transition-colors hover:bg-accent/40 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive md:h-9"
        >
          <Clock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-medium">{value || t("timezonePlaceholder")}</span>
          {offset ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {offset}
              {time ? ` · ${time}` : ""}
            </span>
          ) : null}
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] min-w-[18rem] p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).querySelector<HTMLInputElement>("input")?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label={t("timezoneSearch")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t("timezoneSearchPlaceholder")}
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
        </div>
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={t("timezone")}
          className="relative max-h-72 overflow-y-auto overscroll-contain p-1"
        >
          {results.length === 0 ? (
            <li role="presentation" className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("timezoneEmpty")}
            </li>
          ) : (
            results.map((zone, index) => {
              const selected = zone === value;
              return (
                <li
                  key={zone}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => choose(zone)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm md:min-h-9",
                    index === activeIndex && "bg-accent text-accent-foreground"
                  )}
                >
                  <Check
                    aria-hidden="true"
                    className={cn("size-4 shrink-0", selected ? "opacity-100" : "opacity-0")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{timeZoneCity(zone)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{zone}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {offsets.get(zone)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
});
