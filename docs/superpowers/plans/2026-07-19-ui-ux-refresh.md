# UI/UX Refresh Implementation Plan (Modern SaaS + Dark Mode)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the whole app to a "modern SaaS" visual language (indigo/violet brand, gradient stat cards, colored status pills, card shadows, larger radius) and add a light/dark theme toggle, keeping the customer-facing invoice document always white.

**Architecture:** Change design tokens in `globals.css` (light + dark HSL sets, gradient/shadow CSS vars), wire `next-themes` via a `ThemeProvider` + `ThemeToggle`, introduce a shared `TopNav` app shell, then restyle components and pages phase by phase. Status display is unified behind one `statusStyle()` helper + `StatusBadge` component. No data-model, server-action, or money-logic changes.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind CSS 3 (`darkMode: ["class"]`), shadcn/ui, next-themes (already installed ^0.4.6), next-intl, Jest.

**Spec:** `docs/superpowers/specs/2026-07-19-ui-ux-refresh-design.md`

## Global Constraints

- Brand: indigo `#6366f1` → violet `#8b5cf6`. `--radius: 0.75rem`. Money always `tabular-nums`, right-aligned.
- Dark mode is class-based (`.dark` on `<html>`); `next-themes` `attribute="class"`, `defaultTheme="light"`, `enableSystem={false}`.
- The invoice document (`#printable-content` in the detail page) stays white in both themes; it already uses hardcoded `bg-white`/`text-slate-*`, do not convert it to theme tokens.
- No changes to `db/`, `actions/`, money/tax math, or PDF page structure (PDF may only change colors/alignment).
- Every task ends green: `npm test` && `npx tsc --noEmit` && `npm run lint` (lint exits 0; pre-existing `any`/`img` warnings are allowed, add no new errors).
- New user-visible strings go into BOTH `messages/en.json` and `messages/zh-TW.json`.
- Commit message trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Do NOT push (push triggers homelab deploy). Work stays local until the user asks.

### Local visual-preview harness (used by every "visual verify" step)

Run once per verification from repo root; reuse the throwaway DB across checks:

```bash
docker rm -f ui-preview-db 2>/dev/null; docker run -d --name ui-preview-db -p 55440:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=quote-system postgres:16-alpine >/dev/null
until docker exec ui-preview-db pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
DATABASE_URL="postgres://postgres:postgres@localhost:55440/quote-system" npx drizzle-kit push --force >/dev/null
docker exec ui-preview-db psql -U postgres -d quote-system -c "
INSERT INTO customers (company_name,contact_person,email) VALUES ('宏達電子','林經理','a@a.co'),('日昇貿易','王小姐','b@b.co');
INSERT INTO quotations (quotation_number,customer_id,salesperson,valid_until,subtotal,tax_rate,tax_amount,total_amount,status) VALUES
 ('QT-20260719-002',1,'Claude','2026-08-18',100000,500,5000,105000,'draft'),
 ('QT-20260719-001',2,'Jack','2026-08-18',556000,500,28485,584850,'sent');
INSERT INTO quotation_items (quotation_id,product_name,quantity,unit_price) VALUES (1,'測試項目 A',2,50000),(2,'服務 B',1,556000);" >/dev/null
DATABASE_URL="postgres://postgres:postgres@localhost:55440/quote-system" PORT=3700 npm run dev
```

Then drive with playwright MCP: navigate to `http://localhost:3700/zh-TW[...]`, toggle theme, screenshot. Stop dev + `docker rm -f ui-preview-db` when done. (A production build is not required for visual checks; `npm run dev` is fine.)

---

## Phase 1 — Design system + theme infrastructure

### Task 1: Design tokens (light + dark) + gradient/shadow utilities

**Files:**
- Modify: `app/[locale]/globals.css:5-59` (`:root` and `.dark` token blocks) and add a utilities block.

**Interfaces:**
- Produces: CSS classes `.bg-grad-brand`, `.bg-grad-sky`, `.bg-grad-amber`, `.shadow-brand`; updated shadcn HSL tokens consumed app-wide.

- [ ] **Step 1: Replace the `:root` token block** (`globals.css` lines 6-32) with:

```css
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;
    --primary: 239 84% 67%;
    --primary-foreground: 0 0% 100%;
    --secondary: 220 14% 96%;
    --secondary-foreground: 222 47% 11%;
    --muted: 220 14% 96%;
    --muted-foreground: 220 9% 46%;
    --accent: 238 100% 97%;
    --accent-foreground: 239 84% 60%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 239 84% 67%;
    --radius: 0.75rem;
    --chart-1: 239 84% 67%;
    --chart-2: 199 89% 48%;
    --chart-3: 27 96% 61%;
    --chart-4: 160 84% 39%;
    --chart-5: 340 82% 62%;
  }
```

- [ ] **Step 2: Replace the `.dark` token block** (`globals.css` lines 34-59) with:

```css
  .dark {
    --background: 222 47% 7%;
    --foreground: 210 40% 96%;
    --card: 221 39% 16%;
    --card-foreground: 210 40% 96%;
    --popover: 221 39% 16%;
    --popover-foreground: 210 40% 96%;
    --primary: 239 84% 70%;
    --primary-foreground: 0 0% 100%;
    --secondary: 217 33% 20%;
    --secondary-foreground: 210 40% 96%;
    --muted: 217 33% 20%;
    --muted-foreground: 215 20% 65%;
    --accent: 217 33% 24%;
    --accent-foreground: 210 40% 96%;
    --destructive: 0 63% 45%;
    --destructive-foreground: 0 0% 100%;
    --border: 217 33% 23%;
    --input: 217 33% 23%;
    --ring: 239 84% 70%;
    --chart-1: 239 84% 70%;
    --chart-2: 199 89% 55%;
    --chart-3: 27 96% 61%;
    --chart-4: 160 84% 45%;
    --chart-5: 340 82% 66%;
  }
```

- [ ] **Step 3: Append a utilities block** at the end of `globals.css` (after the existing `@layer utilities` print block, add a new one):

```css
@layer utilities {
  .bg-grad-brand { background-image: linear-gradient(135deg, #6366f1, #8b5cf6); }
  .bg-grad-sky   { background-image: linear-gradient(135deg, #0ea5e9, #22d3ee); }
  .bg-grad-amber { background-image: linear-gradient(135deg, #f59e0b, #f97316); }
  .shadow-brand  { box-shadow: 0 12px 26px -10px rgba(99, 102, 241, 0.55); }
  .app-bg        { background-image: linear-gradient(160deg, hsl(var(--background)), hsl(var(--accent))); }
}
```

- [ ] **Step 4: Verify build + lint** — Run: `npx tsc --noEmit && npm run lint && npm test`. Expected: all pass (CSS-only change; tests unaffected).
- [ ] **Step 5: Commit** — `git add app/[locale]/globals.css && git commit -m "feat(ui): indigo brand tokens, dark palette, gradient utilities"`

---

### Task 2: ThemeProvider + ThemeToggle wired into layout

**Files:**
- Create: `components/providers/theme-provider.tsx`
- Create: `components/theme-toggle.tsx`
- Modify: `app/[locale]/layout.tsx`
- Modify: `messages/en.json`, `messages/zh-TW.json` (add `Common.toggleTheme`)

**Interfaces:**
- Consumes: `next-themes`.
- Produces: `<ThemeProvider>` wrapper; `<ThemeToggle/>` used by TopNav (Task 3).

- [ ] **Step 1: Create `components/providers/theme-provider.tsx`**

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 2: Create `components/theme-toggle.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("Common");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("toggleTheme")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
```

- [ ] **Step 3: Wire into `app/[locale]/layout.tsx`** — add imports and wrap. `<html>` gets `suppressHydrationWarning`; `ThemeProvider` wraps inside `<body>` around `AppConfigProvider`:

```tsx
import { ThemeProvider } from "@/components/providers/theme-provider";
// ...
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <NextTopLoader color="#6366f1" /* ...keep other props... */ />
          <AppConfigProvider value={publicConfig}>
            <NextIntlClientProvider messages={messages}>
              {children}
            </NextIntlClientProvider>
          </AppConfigProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
```

(Also change the existing `NextTopLoader` `color="#2563eb"` and its two `shadow` hex refs to `#6366f1`.)

- [ ] **Step 4: Add i18n key** — `messages/en.json` `Common`: `"toggleTheme": "Toggle theme"`; `messages/zh-TW.json` `Common`: `"toggleTheme": "切換主題"`.
- [ ] **Step 5: Verify** — `npx tsc --noEmit && npm run lint && npm test` all green.
- [ ] **Step 6: Visual check** — start preview harness; at `http://localhost:3700/zh-TW` open devtools and run `document.documentElement.classList.toggle('dark')` — confirm background/foreground flip to the dark palette (page still has old layout; just colors). Stop harness.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(ui): next-themes provider + theme toggle"`

---

### Task 3: Button gradient variant + Card/Badge polish

**Files:**
- Modify: `components/ui/button.tsx:8,23-28` (focus ring width, add `gradient` variant)
- Modify: `components/ui/card.tsx:12` (softer default shadow)
- Modify: `components/ui/badge.tsx` (add `pill` size affordance via class usage — no variant change needed; keep as-is unless used)

**Interfaces:**
- Produces: `<Button variant="gradient">` (brand gradient + `shadow-brand`); consumed by CTAs in later tasks.

- [ ] **Step 1: Update `buttonVariants` in `components/ui/button.tsx`** — change the base ring from `focus-visible:ring-1` to `focus-visible:ring-2 focus-visible:ring-ring/50` and add a `gradient` variant:

```tsx
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        gradient:
          "bg-grad-brand text-white shadow-brand hover:opacity-95",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
```

- [ ] **Step 2: Soften Card shadow** — in `components/ui/card.tsx`, change the Card base class `"rounded-xl border bg-card text-card-foreground shadow"` → `"rounded-xl border bg-card text-card-foreground shadow-sm"`.
- [ ] **Step 3: Verify** — `npx tsc --noEmit && npm run lint && npm test` green.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(ui): gradient button variant, softer card shadow"`

---

## Phase 2 — App shell (shared top nav)

### Task 4: TopNav + layout integration + de-duplicate page headers

**Files:**
- Create: `components/app-shell/top-nav.tsx`
- Modify: `app/[locale]/layout.tsx` (render `<TopNav/>` above children)
- Modify: `app/[locale]/page.tsx` (remove in-page `LanguageSwitcher`, keep page title/CTA)
- Modify: `app/[locale]/quotes/page.tsx` (remove the "返回儀表板" button; nav lives in TopNav)
- Modify: `messages/en.json`, `messages/zh-TW.json` (add `Nav.dashboard`, `Nav.quotes`)

**Interfaces:**
- Consumes: `useAppConfig()` (companyName), `LanguageSwitcher`, `ThemeToggle`, `Link` from `@/navigation`, `usePathname`.
- Produces: sticky `<TopNav/>` app shell.

- [ ] **Step 1: Create `components/app-shell/top-nav.tsx`**

```tsx
"use client";

import Image from "next/image";
import { Link, usePathname } from "@/navigation";
import { useTranslations } from "next-intl";
import { useAppConfig } from "@/components/providers/app-config-provider";
import LanguageSwitcher from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function TopNav() {
  const t = useTranslations("Nav");
  const { companyName } = useAppConfig();
  const pathname = usePathname();
  const links = [
    { href: "/", label: t("dashboard"), match: (p: string) => p === "/" },
    { href: "/quotes", label: t("quotes"), match: (p: string) => p.startsWith("/quotes") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Image src="/api/branding-icon" alt="" width={24} height={24} className="rounded" unoptimized />
          <span className="truncate max-w-[40vw]">{companyName}</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors",
                l.match(pathname)
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Render in `app/[locale]/layout.tsx`** — inside `NextIntlClientProvider`, wrap children:

```tsx
            <NextIntlClientProvider messages={messages}>
              <TopNav />
              <main className="min-h-[calc(100vh-3.5rem)] app-bg">{children}</main>
            </NextIntlClientProvider>
```

(add `import { TopNav } from "@/components/app-shell/top-nav";`)

- [ ] **Step 3: Add i18n keys** — both message files, new top-level `"Nav": { "dashboard": ... , "quotes": ... }`. EN: `"Dashboard"`, `"Quotations"`. zh-TW: `"儀表板"`, `"報價單"`.
- [ ] **Step 4: Remove duplicated chrome** — in `app/[locale]/page.tsx` remove `<LanguageSwitcher />` and its import (now in TopNav). In `app/[locale]/quotes/page.tsx` remove the "返回儀表板" `Link`+`Button` (nav is global); keep the "建立報價單" CTA.
- [ ] **Step 5: Verify** — `npx tsc --noEmit && npm run lint && npm test` green.
- [ ] **Step 6: Visual check** — preview harness: `/zh-TW` and `/zh-TW/quotes` show the sticky top nav with brand, active-link highlight, language + theme toggle; theme toggle flips palette and persists across reload. Stop harness.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(ui): shared top-nav app shell, de-duplicate page headers"`

---

## Phase 3 — Dashboard

### Task 5: Gradient StatCard + dashboard restyle

**Files:**
- Modify: `components/dashboard/stat-card.tsx`
- Modify: `app/[locale]/page.tsx` (assign brand/sky/amber variants; layout)
- Modify: `components/dashboard/recent-quotes-table.tsx` (table polish; status via Task 6 badge is done in Phase 4 — here only spacing/tabular-nums)

**Interfaces:**
- Consumes: gradient utilities (Task 1).
- Produces: `<StatCard variant="brand"|"sky"|"amber"|"plain" ... />`.

- [ ] **Step 1: Rewrite `components/dashboard/stat-card.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "brand" | "sky" | "amber" | "plain";

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  variant?: Variant;
}

const gradients: Record<Exclude<Variant, "plain">, string> = {
  brand: "bg-grad-brand",
  sky: "bg-grad-sky",
  amber: "bg-grad-amber",
};

export function StatCard({ title, value, description, icon: Icon, variant = "plain" }: StatCardProps) {
  const filled = variant !== "plain";
  return (
    <Card className={cn("overflow-hidden border-0", filled && `${gradients[variant]} text-white shadow-brand`)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={cn("text-sm font-medium", filled && "text-white/85")}>{title}</CardTitle>
        <Icon className={cn("h-4 w-4", filled ? "text-white/85" : "text-muted-foreground")} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
        <p className={cn("text-xs", filled ? "text-white/75" : "text-muted-foreground")}>{description}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Assign variants in `app/[locale]/page.tsx`** — the three `<StatCard>`s get `variant="brand"` (總營收), `variant="sky"` (報價單總數), `variant="amber"` (客戶總數). Ensure the container uses `mx-auto max-w-6xl px-4 md:px-6 py-6 space-y-8` (drop the old `container` if present).
- [ ] **Step 3: Recent-quotes table spacing** — in `components/dashboard/recent-quotes-table.tsx`, add `text-right tabular-nums` to the amount cell and `font-variant` already handled; header row `bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground`.
- [ ] **Step 4: Verify** — `npx tsc --noEmit && npm run lint && npm test` green.
- [ ] **Step 5: Visual check** — preview harness `/zh-TW`: three gradient stat cards (indigo/sky/amber), readable white text (AA), dark mode still looks right. Stop harness.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(ui): gradient dashboard stat cards"`

---

## Phase 4 — Quote list + unified status system

### Task 6: `statusStyle` helper + `StatusBadge` (TDD)

**Files:**
- Create: `lib/status.ts`
- Test: `tests/unit/lib/status.test.ts`
- Rewrite: `components/quotes/quote-status-badge.tsx`
- Modify: `messages/en.json`, `messages/zh-TW.json` (ensure `Status` namespace with the 4 workflow labels + expired)

**Interfaces:**
- Produces:
  - `type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";`
  - `statusStyle(status: string): string` — Tailwind classes (light+dark) for the pill; unknown → draft styling.
  - `<StatusBadge status={string|null} validUntil={Date|string|null} />`

- [ ] **Step 1: Write failing test `tests/unit/lib/status.test.ts`**

```ts
import { statusStyle } from "@/lib/status";

describe("statusStyle", () => {
  it("maps each known status to its own class set", () => {
    const draft = statusStyle("draft");
    const sent = statusStyle("sent");
    const accepted = statusStyle("accepted");
    const rejected = statusStyle("rejected");
    expect(draft).toContain("slate");
    expect(sent).toContain("blue");
    expect(accepted).toContain("green");
    expect(rejected).toContain("red");
    // all include a dark: variant
    for (const c of [draft, sent, accepted, rejected]) expect(c).toContain("dark:");
  });

  it("falls back to draft styling for unknown/empty status", () => {
    expect(statusStyle("weird")).toBe(statusStyle("draft"));
    expect(statusStyle("")).toBe(statusStyle("draft"));
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npm test -- tests/unit/lib/status.test.ts` (module not found).
- [ ] **Step 3: Create `lib/status.ts`**

```ts
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";

const STYLES: Record<QuoteStatus, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200",
};

export const EXPIRED_STYLE =
  "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200";

export function statusStyle(status: string): string {
  return STYLES[(status as QuoteStatus)] ?? STYLES.draft;
}
```

- [ ] **Step 4: Run — expect PASS** — `npm test -- tests/unit/lib/status.test.ts`.
- [ ] **Step 5: Rewrite `components/quotes/quote-status-badge.tsx`**

```tsx
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { statusStyle, EXPIRED_STYLE } from "@/lib/status";

interface Props {
  status: string | null;
  validUntil?: Date | string | null;
}

export function StatusBadge({ status, validUntil }: Props) {
  const t = useTranslations("Status");
  const expired = validUntil ? new Date(validUntil) < new Date() : false;
  const key = status || "draft";
  const cls = expired ? EXPIRED_STYLE : statusStyle(key);
  const label = expired ? t("expired") : t(key);
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", cls)}>
      {label}
    </span>
  );
}
```

- [ ] **Step 6: Add `Status` i18n namespace** — both files, `"Status": { "draft","sent","accepted","rejected","expired" }`. EN: `Draft/Sent/Accepted/Rejected/Expired`. zh-TW: `草稿/已發送/已成交/已拒絕/已過期`.
- [ ] **Step 7: Verify** — `npm test && npx tsc --noEmit && npm run lint`. (Note: `quote-status-badge.tsx` now exports `StatusBadge` not `QuoteStatusBadge`; callers are updated in Task 7. tsc will flag the old import in `quotes-table.tsx` — that is fixed in Task 7. To keep this task green, also do Task 7's import swap now if executing sequentially, OR temporarily keep a `QuoteStatusBadge` alias export. Use the alias to keep tasks independent:)

```tsx
export const QuoteStatusBadge = StatusBadge; // transitional alias, removed in Task 7
```

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(ui): unified StatusBadge + statusStyle helper (TDD)"`

---

### Task 7: Quote list table restyle + empty state

**Files:**
- Modify: `components/quotes/quotes-table.tsx`
- Modify: `app/[locale]/quotes/page.tsx` (container + empty state)
- Modify: `components/dashboard/recent-quotes-table.tsx` (use `StatusBadge`)

**Interfaces:**
- Consumes: `StatusBadge` (Task 6).

- [ ] **Step 1: Add a customer avatar helper + swap status column in `components/quotes/quotes-table.tsx`** — import `{ StatusBadge } from "./quote-status-badge"` (remove old `QuoteStatusBadge` import). Replace the `validUntil` column's `<QuoteStatusBadge validUntil={...}/>` with `<StatusBadge status={quote.status} validUntil={quote.validUntil} />`. In the customer cell, prepend an avatar block:

```tsx
<span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-grad-brand text-xs font-bold text-white align-middle">
  {(quote.customer?.companyName ?? "?").slice(0, 1)}
</span>
```

Header cells: add `bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground` styling; amount cell `text-right tabular-nums font-semibold`.

- [ ] **Step 2: Wrap list in a Card + empty state in `app/[locale]/quotes/page.tsx`** — container `mx-auto max-w-6xl px-4 md:px-6 py-6`; wrap `<QuotesTable>` with `<div className="rounded-xl border bg-card shadow-sm overflow-hidden">`. When `data.length === 0`, the table already renders an empty row — enhance its cell to an icon + text + CTA (FileText icon, `t("emptyState")`, a `<Link href="/quotes/new">` gradient button).
- [ ] **Step 3: Dashboard recent table uses StatusBadge** — in `components/dashboard/recent-quotes-table.tsx`, replace the inline `<Badge variant="outline">{t(status...)}</Badge>` with `<StatusBadge status={q.status} />` (import from `@/components/quotes/quote-status-badge`); drop the now-unused `Badge` import if nothing else uses it.
- [ ] **Step 4: Remove transitional alias** — delete the `QuoteStatusBadge` alias line from `quote-status-badge.tsx`; grep to confirm no remaining `QuoteStatusBadge` importers: `grep -rn "QuoteStatusBadge" components app` → 0.
- [ ] **Step 5: Verify** — `npm test && npx tsc --noEmit && npm run lint` green.
- [ ] **Step 6: Visual check** — preview `/zh-TW/quotes`: avatars, colored status pills (draft grey, sent blue), hover, right-aligned amounts; empty DB path shows the empty state (temporarily point at an empty DB or delete rows). Dashboard `/zh-TW` recent table shows matching pills. Stop harness.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(ui): modern quote list table, avatars, unified status pills, empty state"`

---

## Phase 5 — Quote form

### Task 8: Form restyle — card sections, focus rings, gradient total

**Files:**
- Modify: `components/quote-form.tsx`

**Interfaces:**
- Consumes: gradient utilities, `useAppConfig` (already used).

- [ ] **Step 1: Totals card → gradient** — in `components/quote-form.tsx`, the summary `Card` (the `w-full md:w-[350px]` one) gets `className="w-full md:w-[350px] border-0 bg-grad-brand text-white shadow-brand"`; inside, muted label spans become `text-white/80`, the total value `text-white`, and the tax-rate `Input` gets `className="w-20 h-8 text-right bg-white/15 border-white/30 text-white placeholder:text-white/60"`.
- [ ] **Step 2: Field focus rings** — the shared `FormField` `Input` and the item-row `Input`s: append `focus-visible:ring-2 focus-visible:ring-primary/40` to their className (Input already forwards className).
- [ ] **Step 3: Primary CTA → gradient** — the submit `Button` (`儲存/更新`) gets `variant="gradient"`; keep `size="lg"`.
- [ ] **Step 4: Section cards** — ensure the three `Card`s (customer / items / totals) render with the new `rounded-xl shadow-sm`; add `text-xl` to `CardTitle`s for hierarchy.
- [ ] **Step 5: Verify** — `npm test && npx tsc --noEmit && npm run lint` green.
- [ ] **Step 6: Visual check** — preview `/zh-TW/quotes/new`: gradient totals card, focus ring on inputs, gradient save button; live totals still compute ($ tabular). Dark mode: form cards themed, totals card still gradient. Stop harness.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(ui): quote form — section cards, focus rings, gradient totals + CTA"`

---

## Phase 6 — Detail page chrome + print/PDF polish

### Task 9: Detail page app-chrome themes; invoice stays white; PDF color accents

**Files:**
- Modify: `app/[locale]/quotes/[id]/page.tsx` (outer bg/action bar theme; document forced white; StatusBadge in header)
- Modify: `app/[locale]/globals.css` (print block spacing tweak only)
- Modify: `components/pdf/QuotePDFDocument.tsx` (brand color accents only — no structural change)

**Interfaces:**
- Consumes: `StatusBadge` (Task 6).

- [ ] **Step 1: Theme the outer page, lock the document white** — in `app/[locale]/quotes/[id]/page.tsx`: change the outermost wrapper `bg-gray-100/50` → `bg-transparent` (inherits `app-bg` from layout `main`); the document container keeps `bg-white ... text-slate-900` (already hardcoded). Add `className="bg-white text-slate-900"` explicitly on `#printable-content` if not already present so dark mode never bleeds in. Replace the inline "Valid/Expired" pill (`<div ...>{new Date(quote.validUntil) < new Date() ? "Expired" : "Valid"}</div>`) with `<StatusBadge status={quote.status} validUntil={quote.validUntil} />`.
- [ ] **Step 2: Action bar buttons** — the top action row (返回列表 / QuoteActions) already uses Button/outline; leave functioning. No theme lock needed (it's outside `#printable-content`, themes normally).
- [ ] **Step 3: Print CSS spacing** — in `globals.css` print block, no structural change; confirm `#printable-content` padding rule stays `20px`. (No edit unless single-page regression observed.)
- [ ] **Step 4: PDF brand accent** — in `components/pdf/QuotePDFDocument.tsx`, change the header bottom border and the totals `totalRowFinal` top border color from slate to brand indigo `#6366f1` (edit the `colors` object: add `brand: "#6366f1"`, use it for `header.borderBottomColor` and `totalRowFinal.borderTopColor`). No layout/structure change.
- [ ] **Step 5: Verify** — `npm test && npx tsc --noEmit && npm run lint` green.
- [ ] **Step 6: Visual check** — preview `/zh-TW/quotes/2` in dark mode: **document is white**, outer page dark; header shows status pill; PDF at `/api/quotes/2/pdf` returns 200 with indigo accent lines and unchanged layout. Stop harness.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(ui): detail-page chrome themes, invoice stays white, PDF brand accents"`

---

## Phase 7 — Final verification

### Task 10: Full light/dark visual sweep + responsive + regression

- [ ] **Step 1: Green gate** — `npm test && npx tsc --noEmit && npm run lint` all pass.
- [ ] **Step 2: Screenshot sweep (playwright)** — start harness; for each of `/zh-TW`, `/zh-TW/quotes`, `/zh-TW/quotes/new`, `/zh-TW/quotes/2`: screenshot light, toggle dark, screenshot dark. Confirm: no unreadable text (AA), no un-themed white boxes in dark (except the invoice document), status pills correct colors.
- [ ] **Step 3: Theme persistence** — toggle dark, reload page → still dark; toggle light, reload → light. (`next-themes` localStorage.)
- [ ] **Step 4: Responsive** — resize to 375px: top nav usable, tables scroll horizontally, form sticky action bar and gradient totals stack correctly.
- [ ] **Step 5: Invoice-white in dark** — `/zh-TW/quotes/2` with `.dark` on html: document remains white/slate; PDF `/api/quotes/2/pdf` still 200 `application/pdf`.
- [ ] **Step 6: Cleanup** — stop dev server, `docker rm -f ui-preview-db`; `git status` clean (all committed, none pushed).
- [ ] **Step 7: Report** — summarize what changed; note commits are local/unpushed (push = deploy).

---

## Self-Review

**1. Spec coverage:**
- Design tokens (light+dark, gradients, shadows) → Task 1 ✓
- Theme infra (provider, toggle, layout) → Task 2 ✓
- Button/Card/Badge base → Task 3 ✓
- App shell / top nav → Task 4 ✓
- Gradient StatCard + dashboard → Task 5 ✓
- Unified status system (statusStyle + StatusBadge, fixes validUntil-vs-status split) → Task 6 ✓
- List table + avatars + empty state → Task 7 ✓
- Form cards + focus + gradient total → Task 8 ✓
- Detail chrome themed + invoice white + print + PDF accents → Task 9 ✓
- Accessibility, persistence, responsive, PDF-still-works → Task 10 ✓
- Testing: statusStyle unit test (Task 6), existing tests stay green (every task), visual verify (each phase) ✓
- Phasing matches spec's 6 layers (+ final verify) ✓

**2. Placeholder scan:** No TBD/TODO; concrete code + class strings + commands throughout.

**3. Type consistency:** `StatusBadge` props `{status: string|null, validUntil?}` consistent Task 6→7→9. `statusStyle(status: string): string` consistent. `StatCard` `variant` union consistent Task 5. Transitional `QuoteStatusBadge` alias introduced in Task 6 Step 7, removed in Task 7 Step 4 — keeps each task independently green.

**4. Out-of-scope guardrails:** No edits to `db/`, `actions/`, money math, or PDF structure — only PDF colors (Task 9 Step 4).
