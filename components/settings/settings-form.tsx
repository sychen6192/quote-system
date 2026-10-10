"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type BaseSyntheticEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useForm,
  useFormContext,
  useFormState,
  type ControllerRenderProps,
  type FieldValues,
  type Path,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Check, CircleDot, FileCog, Loader2, RotateCcw, type LucideIcon } from "lucide-react";
import { saveSettings } from "@/actions/settings";
import type { ActionResult } from "@/actions/types";
import type { SettingsSection } from "@/lib/settings/schema";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  changedKeys,
  formFieldOfErrorPath,
  type FieldMeta,
  type FieldValue,
  type SettingsTab,
} from "./model";
import { useSettingsPage } from "./settings-context";

/** 44px tall on phones (touch), the compact 36px from md up. */
export const fieldClass = "h-11 md:h-9";

// --- saving -----------------------------------------------------------------

/** saveSettings for several sections in turn; stops at the first failure. */
export async function saveSections(
  patches: readonly [SettingsSection, Record<string, unknown>][]
): Promise<ActionResult> {
  for (const [section, patch] of patches) {
    if (Object.keys(patch).length === 0) continue;
    const result = await saveSettings(section, patch);
    if (!result.success) return result;
  }
  return { success: true };
}

type SaveFn<TOut> = (output: TOut, changed: string[]) => Promise<ActionResult>;

type SectionFormApi = {
  /** Resets a saved field to its .env / default value (saves null). */
  resetToFallback: (section: SettingsSection, name: string, fallback: FieldValue) => Promise<void>;
};

const SectionFormContext = createContext<SectionFormApi | null>(null);

// useForm's resetOptions (keepDirtyValues, so a refresh never clobbers
// edits) also apply to every form.reset() call; Discard and post-save resets
// must replace the edited values.
const EXPLICIT_RESET = { keepDirtyValues: false } as const;

function toFormValue(value: FieldValue): unknown {
  return typeof value === "number" ? String(value) : value;
}

/**
 * One Settings section as its own react-hook-form: zod validation, Save /
 * Discard, server field errors mapped back to the inputs, session expiry,
 * router.refresh() after saving, and registration with the page's
 * unsaved-changes guard.
 */
export function useSettingsForm<TForm extends FieldValues, TOut>({
  tab,
  schema,
  initial,
  save,
  toForm,
  pendingInput = false,
  onDiscard,
}: {
  tab: SettingsTab;
  schema: z.ZodType<TOut>;
  /** Current server values in form shape (new object → form follows, keeping edits) */
  initial: TForm;
  save: SaveFn<TOut>;
  /** Validated output → form values (what the form shows once saved) */
  toForm: (output: TOut) => TForm;
  /**
   * Typed input that is not a form value yet (an address in the CC field
   * before Enter): counts as an unsaved change, so Save is enabled and the
   * leave guard asks.
   */
  pendingInput?: boolean;
  /** Also clear such input on Discard. */
  onDiscard?: () => void;
}) {
  const t = useTranslations("Settings");
  const router = useRouter();
  const page = useSettingsPage();
  const { sessionExpired } = page;
  const [saving, setSaving] = useState(false);

  const form = useForm<TForm, unknown, TOut>({
    // The schemas preprocess strings into numbers etc., so their input type
    // is wider than the form's; the runtime contract is the same.
    resolver: zodResolver(schema as never) as unknown as Resolver<TForm, unknown, TOut>,
    mode: "onTouched",
    // revealFirstError scrolls it clear of the sticky bars instead.
    shouldFocusError: false,
    values: initial,
    resetOptions: { keepDirtyValues: true },
  });

  const keys = useMemo(() => Object.keys(initial), [initial]);
  const formRef = useRef<HTMLFormElement>(null);

  // Native focus scrolling would leave the field under the sticky tab strip
  // or save bar; centre it instead (after React has rendered the errors).
  const revealFirstError = useCallback(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (!field) return;
        field.focus({ preventScroll: true });
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        field.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
      })
    );
  }, []);
  const baseline = useRef(initial);
  useEffect(() => {
    baseline.current = initial;
  }, [initial]);

  const saveRef = useRef(save);
  const toFormRef = useRef(toForm);
  const onDiscardRef = useRef(onDiscard);
  const pendingRef = useRef(pendingInput);
  useEffect(() => {
    saveRef.current = save;
    toFormRef.current = toForm;
    onDiscardRef.current = onDiscard;
    pendingRef.current = pendingInput;
  });

  const fail = useCallback(
    (result: Exclude<ActionResult, { success: true }>) => {
      switch (result.code) {
        case "UNAUTHORIZED":
          sessionExpired();
          return;
        case "VALIDATION": {
          for (const [path, messages] of Object.entries(result.fieldErrors)) {
            const field = formFieldOfErrorPath(path, keys);
            if (!field || !messages?.length) continue;
            form.setError(field as Path<TForm>, { type: "server", message: messages[0] });
          }
          revealFirstError();
          toast.error(t("toast.invalid"));
          return;
        }
        case "RATE_LIMITED":
          toast.error(t("toast.rateLimited"));
          return;
        default:
          toast.error(t("toast.failed"));
      }
    },
    [form, keys, revealFirstError, sessionExpired, t]
  );

  const persist = useCallback(
    async (output: TOut): Promise<boolean> => {
      const changed = changedKeys(baseline.current, form.getValues(), keys);
      const next = toFormRef.current(output);
      if (changed.length === 0) {
        form.reset(next, EXPLICIT_RESET);
        return true;
      }
      setSaving(true);
      let result: ActionResult;
      try {
        result = await saveRef.current(output, changed);
      } catch (error) {
        // An expired session makes the proxy answer 401, so the action throws.
        console.error(error);
        setSaving(false);
        sessionExpired();
        return false;
      }
      setSaving(false);
      if (!result.success) {
        fail(result);
        return false;
      }
      baseline.current = next;
      form.reset(next, EXPLICIT_RESET);
      toast.success(t("toast.saved"), { duration: 2500 });
      router.refresh();
      return true;
    },
    [fail, form, keys, router, sessionExpired, t]
  );

  const submit = (event?: BaseSyntheticEvent) =>
    form.handleSubmit(persist, revealFirstError)(event);

  const resetToFallback = useCallback(
    async (section: SettingsSection, name: string, fallback: FieldValue) => {
      let result: ActionResult;
      try {
        result = await saveSettings(section, { [name]: null });
      } catch (error) {
        console.error(error);
        sessionExpired();
        return;
      }
      if (!result.success) {
        fail(result);
        return;
      }
      const value = toFormValue(fallback);
      baseline.current = { ...baseline.current, [name]: value };
      form.resetField(name as Path<TForm>, { defaultValue: value as never });
      toast.success(t("reset.done"), { duration: 2500 });
      router.refresh();
    },
    [fail, form, router, sessionExpired, t]
  );

  const { isDirty: formDirty } = useFormState({ control: form.control });
  const isDirty = formDirty || pendingInput;
  const { register, setDirty } = page;
  useEffect(() => {
    setDirty(tab, isDirty);
  }, [isDirty, setDirty, tab]);

  const discard = useCallback(() => {
    form.reset(baseline.current, EXPLICIT_RESET);
    onDiscardRef.current?.();
  }, [form]);

  useEffect(
    () =>
      register(tab, {
        isDirty: () =>
          pendingRef.current || changedKeys(baseline.current, form.getValues(), keys).length > 0,
        save: () =>
          new Promise<boolean>((resolve) => {
            void form.handleSubmit(
              async (output) => resolve(await persist(output)),
              () => {
                revealFirstError();
                resolve(false);
              }
            )();
          }),
        discard,
      }),
    [discard, form, keys, persist, register, revealFirstError, tab]
  );

  const api = useMemo<SectionFormApi>(() => ({ resetToFallback }), [resetToFallback]);

  return {
    form,
    formRef,
    submit,
    saving,
    isDirty,
    discard,
    api,
  };
}

export function SectionFormProvider({ api, children }: { api: SectionFormApi; children: ReactNode }) {
  return <SectionFormContext.Provider value={api}>{children}</SectionFormContext.Provider>;
}

// --- layout -------------------------------------------------------------------

export function SectionHeading({
  icon: Icon,
  title,
  description,
  id,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex"
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 space-y-1">
        <h2 id={id} className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function SettingsCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card text-card-foreground shadow-card", className)}>
      {title ? (
        <div className="flex items-start justify-between gap-3 px-4 pt-4 md:px-6 md:pt-5">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base font-semibold leading-6 tracking-tight">{title}</h3>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn("px-4 pb-5 pt-4 md:px-6 md:pb-6", bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * Save / Discard for one section. Sticky above the phone tab bar (and at the
 * bottom of the window on desktop) while there are unsaved changes.
 */
export function SaveBar({
  dirty,
  saving,
  onDiscard,
  saveLabel,
}: {
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  saveLabel?: string;
}) {
  const t = useTranslations("Settings");
  return (
    <div
      className={cn(
        "z-20 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-shadow",
        dirty
          ? "sticky bottom-safe-20 bg-card/95 shadow-elevated backdrop-blur supports-[backdrop-filter]:bg-card/85 md:bottom-safe-4"
          : "bg-card shadow-card"
      )}
    >
      <p
        role="status"
        className={cn(
          "flex min-w-0 items-center gap-2 text-sm",
          dirty ? "font-medium text-foreground" : "text-muted-foreground"
        )}
      >
        {dirty ? (
          <CircleDot aria-hidden="true" className="size-4 shrink-0 text-warning" />
        ) : (
          <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
        )}
        <span className="truncate">{dirty ? t("unsaved") : t("allSaved")}</span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {dirty ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onDiscard}
            disabled={saving}
            className="h-11 md:h-9"
          >
            {t("discard")}
          </Button>
        ) : null}
        <Button type="submit" disabled={!dirty || saving} className="h-11 min-w-24 md:h-9">
          {saving ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          {saving ? t("saving") : saveLabel ?? t("save")}
        </Button>
      </div>
    </div>
  );
}

// --- fields -------------------------------------------------------------------

function fallbackText(
  value: FieldValue,
  t: ReturnType<typeof useTranslations<"Settings">>
): string | null {
  if (typeof value === "boolean") return value ? t("on") : t("off");
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  const text = String(value);
  return text === "" ? null : text;
}

/** Hit area of at least 44px around a small control (WCAG 2.5.5 on touch). */
const touchHitArea =
  "relative after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] md:after:-inset-y-1.5";

/** "From .env" note or "Reset" for a field, next to its label. */
export function FieldSource({
  section,
  name,
  current,
  label,
}: {
  section: SettingsSection;
  name: string;
  /** current form value, to hide Reset when it would change nothing */
  current?: unknown;
  /** the field's label, for the buttons' accessible names */
  label?: string;
}) {
  const t = useTranslations("Settings");
  const { data } = useSettingsPage();
  const api = useContext(SectionFormContext);
  const meta: FieldMeta | undefined = data.meta[section]?.[name];
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  if (!meta) return null;

  if (meta.source === "env") {
    return (
      <Popover key="env">
        <PopoverTrigger
          className={cn(
            touchHitArea,
            "inline-flex h-6 items-center gap-1 rounded-md border border-info/30 bg-info/10 px-1.5 text-[11px] font-medium text-info transition-colors hover:bg-info/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <FileCog aria-hidden="true" className="size-3" />
          <span aria-hidden={label ? true : undefined}>{t("source.env")}</span>
          {label ? <span className="sr-only">{t("source.envLabel", { field: label })}</span> : null}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 text-sm">
          <p className="font-medium">{t("source.envTitle")}</p>
          <p className="mt-1 text-muted-foreground">
            {t.rich("source.envBody", {
              name: meta.envVar ?? "",
              code: (chunks) => (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                  {chunks}
                </code>
              ),
            })}
          </p>
        </PopoverContent>
      </Popover>
    );
  }

  if (meta.source !== "db" || !api) return null;
  const savedValue = data.values[section]?.[name];
  const same = JSON.stringify(savedValue) === JSON.stringify(meta.fallback);
  const sameAsCurrent =
    current !== undefined && JSON.stringify(current) === JSON.stringify(toFormValue(meta.fallback));
  if (same || sameAsCurrent) return null;

  const shown = fallbackText(meta.fallback, t);
  // Nothing to go back to: clearing the field is the way to "reset" it.
  if (shown === null) return null;
  return (
    <Popover key="reset" open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          touchHitArea,
          "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <RotateCcw aria-hidden="true" className="size-3" />
        <span aria-hidden={label ? true : undefined}>{t("reset.button")}</span>
        {label ? <span className="sr-only">{t("reset.buttonLabel", { field: label })}</span> : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 text-sm">
        <p className="font-medium">{t("reset.title")}</p>
        <p className="mt-1 text-muted-foreground">
          {meta.fallbackSource === "env"
            ? t.rich("reset.toEnv", {
                name: meta.envVar ?? "",
                code: (chunks) => (
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                    {chunks}
                  </code>
                ),
              })
            : t("reset.toDefault")}
        </p>
        <p className="mt-2 line-clamp-3 whitespace-pre-line break-words rounded-md bg-muted px-2 py-1.5 font-medium text-foreground">
          {shown}
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <PopoverClose asChild>
            <Button type="button" variant="ghost" size="sm" className="h-9 md:h-8">
              {t("cancel")}
            </Button>
          </PopoverClose>
          <Button
            type="button"
            size="sm"
            className="h-9 md:h-8"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await api.resetToFallback(section, name, meta.fallback);
              setPending(false);
              setOpen(false);
            }}
          >
            {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            {t("reset.confirm")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type SettingsFieldProps<TForm extends FieldValues, TName extends Path<TForm>> = {
  section: SettingsSection;
  name: TName;
  label: string;
  description?: ReactNode;
  className?: string;
  /** Decorative unit after the value ("days", "%"); the label names the number. */
  suffix?: string;
  children: (field: ControllerRenderProps<TForm, TName>) => ReactNode;
};

/**
 * A labelled form field with its provenance (".env" / Reset), description
 * and localized error. `children` renders the control inside FormControl.
 */
export function SettingsField<TForm extends FieldValues, TName extends Path<TForm>>({
  section,
  name,
  label,
  description,
  className,
  suffix,
  children,
}: SettingsFieldProps<TForm, TName>) {
  const { control } = useFormContext<TForm>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("min-w-0", className)}>
          <div className="flex min-h-6 items-center justify-between gap-2">
            <FormLabel>{label}</FormLabel>
            <FieldSource section={section} name={name} current={field.value} label={label} />
          </div>
          {suffix ? (
            <div className="relative">
              <FormControl>{children(field)}</FormControl>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
              >
                {suffix}
              </span>
            </div>
          ) : (
            <FormControl>{children(field)}</FormControl>
          )}
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** SettingsField bound to one form type, so each field's value type is inferred from its name. */
export function settingsFieldFor<TForm extends FieldValues>() {
  return SettingsField as <TName extends Path<TForm>>(
    props: SettingsFieldProps<TForm, TName>
  ) => ReactNode;
}
