# components/ui

shadcn/ui primitives (new-york style, **Tailwind v3** markup) on Radix. Import from
`@/components/ui/<file>`. Every interactive primitive has a `focus-visible` ring;
anything without its own gets the global `:focus-visible` outline from `globals.css`.

| File | Exports | Notes |
|---|---|---|
| `alert-dialog.tsx` | `AlertDialog*` | Confirmations (delete). |
| `badge.tsx` | `Badge`, `badgeVariants` | |
| `button.tsx` | `Button`, `buttonVariants` | `asChild` for links: `<Button asChild><Link/></Button>`. Icon-only buttons need `aria-label`. |
| `card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | |
| `checkbox.tsx` | `Checkbox` | `checked="indeterminate"` shows a dash. |
| `dialog.tsx` | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`, `DialogCloseButton`, `DialogPortal`, `DialogOverlay` | `DialogContent` props: `showCloseButton` (default true), `closeLabel` (default `UI.close`). Always render a `DialogTitle` (wrap it in `VisuallyHidden` if the design hides it) and a `DialogDescription` or `aria-describedby={undefined}`, or Radix warns. |
| `dropdown-menu.tsx` | `DropdownMenu*` | |
| `field-error.tsx` | `FieldError` | `<p role="alert">` error text; renders nothing when empty. Use it for errors outside `<Form>`, linked with `aria-describedby`. |
| `form.tsx` | `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField` | See "Forms" below. |
| `input.tsx`, `textarea.tsx` | `Input`, `Textarea` | Red border when `aria-invalid="true"`. |
| `kbd.tsx` | `Kbd`, `KbdGroup`, `KbdHotkey` | `<KbdHotkey hotkey="mod+s" />` shows `⌘S` on Apple, `Ctrl+S` elsewhere. |
| `label.tsx` | `Label` | |
| `popover.tsx` | `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`, `PopoverClose` | |
| `scroll-area.tsx` | `ScrollArea`, `ScrollBar` | |
| `select.tsx` | `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton` | Inside a form, put `FormControl` around `SelectTrigger`. |
| `separator.tsx` | `Separator` | |
| `sheet.tsx` | `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`, `SheetClose`, `SheetHandle`, `sheetVariants`, `SheetPortal`, `SheetOverlay` | `side`: `top` / `right` (default) / `bottom` / `left`. `bottom` is the phone preview sheet: `rounded-t-2xl`, `max-h-[92dvh]`, scrolls, bottom padding = 1.5rem + home-indicator inset. Same `showCloseButton` / `closeLabel` as Dialog. `SheetHandle` is a decorative grab bar. The ✕ scrolls with the content: for long content (the A4 preview) put the scrolling on an inner `<div className="min-h-0 flex-1 overflow-y-auto">` so the header and ✕ stay put. The same applies to `DialogContent`. Bottom padding uses `pb-safe-6`, which a caller's `pb-*` cannot override (it sorts later); pass `pb-safe-*` instead. |
| `skeleton.tsx` | `Skeleton` | `aria-hidden`; put `aria-busy` / an sr-only "loading" text on the region. |
| `sonner.tsx` | `Toaster` | |
| `switch.tsx` | `Switch` | Pair with `<Label htmlFor>`. The off track is `muted-foreground/80` (≥ 3:1 against the surface). |
| `table.tsx` | `Table*` | |
| `tabs.tsx` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | |
| `toggle.tsx` | `Toggle`, `toggleVariants` | Own `aria-pressed` button (no `@radix-ui/react-toggle` dependency); same props as Radix Toggle. Prefer `variant="outline"` where the pressed state carries meaning: its pressed border is `primary` (≥ 3:1), while the default variant's pressed fill (`accent`) is subtle. |
| `toggle-group.tsx` | `ToggleGroup`, `ToggleGroupItem` | `type="single"` items are radios. Radix lets the user un-press the active item (value `""`): guard with `onValueChange={(v) => v && setMode(v)}` for amount/percent switches. Give the group a name (`aria-label` / `aria-labelledby`): a `FormLabel`'s `htmlFor` cannot point at a group. |
| `tooltip.tsx` | `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` | Each `Tooltip` brings its own provider, so no app-level provider is needed. Not shown on touch: never put essential info only in a tooltip. |
| `visually-hidden.tsx` | `VisuallyHidden` | `sr-only` span, or `asChild` to hide an existing element. |

## Forms

```tsx
<Form {...form}>
  <FormField control={form.control} name="customerName" render={({ field }) => (
    <FormItem>
      <FormLabel>{t("customer")}</FormLabel>
      <FormControl><Input {...field} /></FormControl>
      <FormDescription>{t("customerHint")}</FormDescription>
      <FormMessage />
    </FormItem>
  )} />
</Form>
```

- `FormControl` sets `id`, `aria-invalid` and `aria-describedby` (only ids that are actually rendered: the description and the visible message).
- `FormMessage` shows the field's error with `role="alert"`. Our zod messages are **keys** of the `Validation` namespace, and by default `FormMessage` renders `t("Validation.<key>")` when that key exists, otherwise the raw message (e.g. a server message that is already translated). Override with `translate={(key) => t(key)}` or a render function child `{(message, error) => …}`. Array-level errors (`errors.items.root`) are shown too.
- Each field re-renders only for its own state (`useFormState({ name })`).
- `FormLabel`, `FormControl`, `FormDescription` and `FormMessage` must sit inside a `FormItem` inside a `FormField`; they throw otherwise.

## Tokens (`app/[locale]/globals.css`, `tailwind.config.ts`)

- Colours: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `info` (each with `-foreground`), `ground` (backdrop behind the paper), `paper` / `paper-foreground` (the A4 sheet: white with dark ink in both themes), `border`, `input`, `ring`, `chart-1…5`.
  `text-success|warning|info|destructive` reach 4.5:1 on the card and on their own `/10` tint, so status chips can use `bg-success/10 text-success`.
- Shadows: `shadow-card`, `shadow-elevated`.
- `font-sans`: `var(--font-sans)` then PingFang TC → Noto Sans TC → Microsoft JhengHei → system-ui. Set `--font-sans` with `next/font` (`variable: "--font-sans"`).
- `aria-invalid:` variant (e.g. `aria-invalid:border-destructive`).
- Container queries: `@container`, `@md:grid-cols-2`, … (`@tailwindcss/container-queries`).

## Utilities

- Safe area (needs `viewport-fit=cover`): `.pt-safe .pb-safe .pl-safe .pr-safe .px-safe .mb-safe` **replace** the padding/margin with the inset. To add the inset to a spacing step use `pb-safe-4` (1rem + inset), likewise `pt-safe-*`, `pl-safe-*`, `pr-safe-*`, `mb-safe-*`, `bottom-safe-*`.
- `.no-scrollbar` (scrollable, no visible bar), `.money` (tabular figures, no wrap; Tailwind's `tabular-nums` also exists).
- `prefers-reduced-motion` shortens all animations/transitions globally.

## Hooks (`@/hooks/*`)

Client-only: import them from `"use client"` modules. Next rejects a Server Component that imports a module importing React hooks, so the pure helpers cannot be used from server code either.

| Hook | Signature |
|---|---|
| `use-media-query` | `useMediaQuery(query): boolean`, `useIsDesktop()` (≥1280px), `usePrefersReducedMotion()`, `DESKTOP_MEDIA_QUERY`. `false` on the server and during hydration. |
| `use-fit-scale` | `useFitScale<Pane, Content>({ enabled?, minScale? })` → `{ paneRef, contentRef, scale, scaledHeight, scaledWidth, ready, remeasure }`. Fit-to-width, never > 1. Refs are callback refs. Put `print:transform-none` on the scaled element and `print:h-auto print:w-auto` on the sized wrapper. Pure: `computeFitScale`, `paneContentWidth`. |
| `use-debounced-value` | `useDebouncedValue(value, ms = 300)`, `useDebouncedCallback(fn, ms = 300, { flushOnUnmount? })` → stable function with `.cancel() .flush() .isPending()`, usable from the first render (also from children's effects), always calling the latest `fn` with the latest `ms`. Pure: `createDebounced(fn, ms \| () => ms)`. |
| `use-mounted` | `useMounted(): boolean` (false on server/hydration). |
| `use-hotkey` | `useHotkey("mod+s" \| string[], handler, { enabled?, preventDefault? = true, enableOnEditable?, allowRepeat? })`. `mod` = ⌘ on Apple, Ctrl elsewhere; exact modifiers; ignores IME composition; combos with Ctrl/⌘/Alt also fire inside inputs, bare keys don't. Also `formatHotkey`, `useIsApplePlatform`, `parseHotkey`, `matchesHotkey`. |
| `use-online-status` | `useOnlineStatus(): boolean` (true on the server). |
