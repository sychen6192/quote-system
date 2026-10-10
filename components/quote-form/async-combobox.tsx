"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Loader2 } from "lucide-react";
import type { SearchResult } from "@/actions/search";
import { Input } from "@/components/ui/input";
import { useDebouncedCallback } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

type Status = "idle" | "loading" | "done" | "error" | "offline";

export type AsyncComboboxLabels = {
  searching: string;
  empty: string;
  error: string;
  offline: string;
  /** Screen-reader summary once results arrive */
  results: (count: number) => string;
  listbox: string;
};

export type AsyncComboboxProps<T> = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "onSelect" | "ref" | "role"
> & {
  ref?: Ref<HTMLInputElement>;
  value: string;
  onValueChange: (value: string) => void;
  onPick: (option: T) => void;
  search: (query: string) => Promise<SearchResult<T>>;
  getKey: (option: T) => string;
  renderOption: (option: T, query: string) => ReactNode;
  labels: AsyncComboboxLabels;
  /** UNAUTHORIZED, or a thrown request while online. */
  onSessionError: () => void;
  debounceMs?: number;
  minChars?: number;
  /** Extra content inside the input (right side), e.g. a lookup button */
  className?: string;
};

function isComposing(event: KeyboardEvent<HTMLInputElement>): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

/**
 * ARIA 1.2 combobox (input + listbox popup) over a server search action:
 * debounced, stale responses dropped, per-query cache, IME-safe keyboard
 * handling (Enter while composing 注音 never picks an option).
 */
export function AsyncCombobox<T>({
  ref,
  value,
  onValueChange,
  onPick,
  search,
  getKey,
  renderOption,
  labels,
  onSessionError,
  debounceMs = 200,
  minChars = 1,
  className,
  onKeyDown,
  onBlur,
  onFocus,
  id,
  ...inputProps
}: AsyncComboboxProps<T>) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-input`;
  const listboxId = `${autoId}-listbox`;
  const optionId = (index: number) => `${autoId}-option-${index}`;

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<T[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const cache = useRef(new Map<string, T[]>());
  const seq = useRef(0);

  const run = useCallback(
    async (term: string) => {
      const cached = cache.current.get(term.toLowerCase());
      if (cached) {
        setResults(cached);
        setQuery(term);
        setStatus("done");
        return;
      }
      const ticket = ++seq.current;
      try {
        const result = await search(term);
        if (ticket !== seq.current) return;
        if (result.success) {
          cache.current.set(term.toLowerCase(), result.data);
          setResults(result.data);
          setQuery(term);
          setStatus("done");
        } else if (result.code === "UNAUTHORIZED") {
          setOpen(false);
          onSessionError();
        } else {
          setStatus("error");
        }
      } catch {
        if (ticket !== seq.current) return;
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          setStatus("offline");
        } else {
          setOpen(false);
          onSessionError();
        }
      }
    },
    [search, onSessionError]
  );

  const debouncedRun = useDebouncedCallback(run, debounceMs);

  const startSearch = (text: string) => {
    const term = text.trim();
    setActive(-1);
    if (term.length < minChars) {
      debouncedRun.cancel();
      seq.current++;
      setResults([]);
      setStatus("idle");
      setOpen(false);
      return;
    }
    setOpen(true);
    if (cache.current.has(term.toLowerCase())) {
      debouncedRun.cancel();
      void run(term);
    } else {
      setStatus("loading");
      debouncedRun(term);
    }
  };

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const pick = (option: T) => {
    debouncedRun.cancel();
    seq.current++;
    close();
    onPick(option);
  };

  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(`${autoId}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, autoId]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || isComposing(event)) return;
    const count = results.length;
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (!open) {
          startSearch(value);
          return;
        }
        if (count) setActive((i) => (i + 1) % count);
        return;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          startSearch(value);
          return;
        }
        if (count) setActive((i) => (i <= 0 ? count - 1 : i - 1));
        return;
      }
      case "Enter": {
        if (open && active >= 0 && active < count) {
          event.preventDefault();
          pick(results[active]);
        }
        return;
      }
      case "Escape": {
        if (open) {
          // Close the popup, not the sheet/dialog around the form.
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        return;
      }
      case "Tab":
        close();
        return;
    }
  };

  const showPopup = open && status !== "idle";
  const showList = showPopup && status === "done" && results.length > 0;
  const message =
    status === "loading"
      ? labels.searching
      : status === "error"
        ? labels.error
        : status === "offline"
          ? labels.offline
          : status === "done" && results.length === 0
            ? labels.empty
            : null;

  return (
    <div className="relative">
      <Input
        {...inputProps}
        ref={ref}
        id={inputId}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showPopup}
        aria-controls={listboxId}
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={cn(status === "loading" && "pr-9", className)}
        onChange={(event) => {
          onValueChange(event.target.value);
          startSearch(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={(event) => {
          onFocus?.(event);
          const term = value.trim().toLowerCase();
          if (term && cache.current.get(term)?.length) {
            setResults(cache.current.get(term) ?? []);
            setStatus("done");
            setOpen(true);
          }
        }}
        onBlur={(event) => {
          onBlur?.(event);
          close();
        }}
      />
      {status === "loading" && open && (
        <Loader2
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
        />
      )}
      <div
        className={cn(
          "absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-elevated",
          !showPopup && "hidden"
        )}
      >
        <ul
          id={listboxId}
          role="listbox"
          aria-label={labels.listbox}
          className={cn("max-h-72 overflow-y-auto overscroll-contain p-1", !showList && "hidden")}
        >
          {showList &&
            results.map((option, index) => (
              <li
                key={getKey(option)}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                className={cn(
                  "flex min-h-11 cursor-pointer select-none flex-col justify-center rounded-md px-3 py-2 text-sm md:min-h-9",
                  index === active ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                )}
                // Keep focus in the input so blur doesn't close the list first.
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActive(index)}
                onClick={() => pick(option)}
              >
                {renderOption(option, query)}
              </li>
            ))}
        </ul>
        {message && (
          <p className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
            {status === "loading" && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            {message}
          </p>
        )}
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {showPopup && status === "done" ? labels.results(results.length) : ""}
      </span>
    </div>
  );
}

/** Wraps the first case-insensitive match of `query` in <mark>. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const index = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-primary/15 px-0.5 font-semibold text-inherit">
        {text.slice(index, index + q.length)}
      </mark>
      {text.slice(index + q.length)}
    </>
  );
}
