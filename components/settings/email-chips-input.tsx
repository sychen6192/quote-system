"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { MAX_CC_EMAILS } from "@/lib/settings/schema";
import { cn } from "@/lib/utils";
import { addEmails } from "./email-list";

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  placeholder?: string;
  /** Whether there is typed text that is not a chip yet. */
  onPendingChange?: (pending: boolean) => void;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/**
 * Email addresses as removable chips. Enter, comma, semicolon or space adds
 * what was typed; pasting a list adds every valid address; Backspace in the
 * empty input removes the last chip.
 */
export const EmailChipsInput = forwardRef<HTMLInputElement, Props>(function EmailChipsInput(
  { value, onChange, onBlur, name, id, placeholder, onPendingChange, ...aria },
  ref
) {
  const t = useTranslations("Settings.email");
  const [draft, setDraft] = useState("");
  const pending = draft.trim() !== "";
  useEffect(() => {
    onPendingChange?.(pending);
  }, [onPendingChange, pending]);
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const list = Array.isArray(value) ? value : [];
  const full = list.length >= MAX_CC_EMAILS;
  const problemId = id ? `${id}-chips-problem` : undefined;

  const commit = (text: string): boolean => {
    if (!text.trim()) {
      setProblem(null);
      return true;
    }
    const result = addEmails(list, text);
    if (result.list.length !== list.length) onChange(result.list);
    if (result.invalid.length) {
      setDraft(result.invalid.join(", "));
      setProblem(t("ccInvalid", { value: result.invalid.join(", ") }));
      return false;
    }
    setDraft("");
    setProblem(result.overflow.length ? t("ccFull", { max: MAX_CC_EMAILS }) : null);
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === "," || event.key === ";" || event.key === " ") {
      if (event.key === "Enter" && !draft.trim()) return;
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && draft === "" && list.length) {
      event.preventDefault();
      onChange(list.slice(0, -1));
      setProblem(null);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!/[,;\s]/.test(text.trim())) return;
    event.preventDefault();
    commit(`${draft} ${text}`);
  };

  const describedBy = [aria["aria-describedby"], problem ? problemId : null].filter(Boolean).join(" ");

  return (
    <div>
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 shadow-sm transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 md:min-h-9 md:py-1",
          (aria["aria-invalid"] === true || aria["aria-invalid"] === "true" || problem) &&
            "border-destructive focus-within:ring-destructive/30"
        )}
      >
        {list.map((email) => (
          <span
            key={email}
            className="inline-flex h-8 max-w-full items-center gap-1 rounded-md bg-secondary pl-2.5 text-sm text-secondary-foreground md:h-7"
          >
            <span className="truncate">{email}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChange(list.filter((entry) => entry !== email));
                inputRef.current?.focus();
              }}
              aria-label={t("ccRemove", { email })}
              className="flex h-full w-8 shrink-0 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:w-7"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          ref={(element) => {
            inputRef.current = element;
            if (typeof ref === "function") ref(element);
            else if (ref) ref.current = element;
          }}
          id={id}
          name={name}
          type="text"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={draft}
          placeholder={full ? t("ccFullPlaceholder") : list.length ? t("ccAddMore") : placeholder}
          aria-describedby={describedBy || undefined}
          aria-invalid={aria["aria-invalid"] || (problem ? true : undefined)}
          onChange={(event) => {
            setDraft(event.target.value);
            if (problem) setProblem(null);
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => {
            commit(draft);
            onBlur?.();
          }}
          className="h-8 min-w-[10rem] flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground md:h-7 md:text-sm"
        />
      </div>
      {problem ? (
        <p id={problemId} role="alert" className="mt-2 text-[0.8rem] font-medium text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
});
