"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/navigation";
import { Input } from "@/components/ui/input";
import { useDebouncedCallback } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { mergeQuery, withQuery, type QueryValue } from "./query";

type ListQueryContextValue = {
  /** true while a filter change is being rendered on the server */
  pending: boolean;
  /** Applies `patch` to the current URL query (resetting the page) via router.replace. */
  update: (patch: Record<string, QueryValue>) => void;
};

const ListQueryContext = createContext<ListQueryContextValue | null>(null);

/**
 * Shares one transition between a list's filter controls and its results, so
 * the results dim while the server renders the new filter.
 */
export function ListQueryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (patch: Record<string, QueryValue>) => {
      // The live URL, not a render-time snapshot: a debounced search may fire
      // after another filter changed.
      const next = mergeQuery(new URLSearchParams(window.location.search), patch);
      startTransition(() => {
        router.replace(withQuery(pathname, next), { scroll: false });
      });
    },
    [pathname, router]
  );

  const value = useMemo(() => ({ pending, update }), [pending, update]);
  return <ListQueryContext.Provider value={value}>{children}</ListQueryContext.Provider>;
}

export function useListQuery(): ListQueryContextValue {
  const ctx = useContext(ListQueryContext);
  if (!ctx) throw new Error("useListQuery must be used within <ListQueryProvider>");
  return ctx;
}

/** Wraps server-rendered results; dims them and sets aria-busy while pending. */
export function ListResults({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useListQuery();
  return (
    <div
      aria-busy={pending || undefined}
      className={cn("transition-opacity duration-200", pending && "pointer-events-none opacity-60", className)}
    >
      {children}
    </div>
  );
}

/**
 * Debounced search box synced to `?<param>=`. Typing does not touch history
 * (router.replace); Enter searches immediately, Escape clears. IME
 * composition (Zhuyin, Pinyin…) is not searched until the text is committed.
 */
export function ListSearchInput({
  initialValue,
  param = "q",
  label,
  placeholder,
  className,
}: {
  initialValue: string;
  param?: string;
  label: string;
  placeholder: string;
  className?: string;
}) {
  const t = useTranslations("Common");
  const { update, pending } = useListQuery();
  const [value, setValue] = useState(initialValue);
  const [syncedFrom, setSyncedFrom] = useState(initialValue);
  const composing = useRef(false);

  const search = useDebouncedCallback((text: string) => {
    update({ [param]: text.trim() || null });
  }, 350);

  // The URL changed from elsewhere (Clear filters, back button): follow it
  // unless the user is mid-typing.
  if (initialValue !== syncedFrom) {
    setSyncedFrom(initialValue);
    if (!search.isPending() && value.trim() !== initialValue) setValue(initialValue);
  }

  const clear = () => {
    search.cancel();
    setValue("");
    // Always navigate: a search may already be in flight even if the URL
    // (initialValue) does not show it yet.
    update({ [param]: null });
  };

  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (!composing.current) search(e.target.value);
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(e) => {
          composing.current = false;
          search(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            search(e.currentTarget.value);
            search.flush();
          } else if (e.key === "Escape" && value) {
            e.preventDefault();
            clear();
          }
        }}
        className="h-11 rounded-lg bg-card pl-9 pr-10 shadow-card md:h-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={clear}
          aria-label={t("clearSearch")}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
      <span className="sr-only" role="status">
        {pending ? t("loading") : ""}
      </span>
    </div>
  );
}
