# Customer Entry Acceleration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the quote form's customer section, let the user (C) search & auto-fill from previously-quoted companies, and (B) look up a Taiwan 統編 to auto-fill company name + address — the lookup being optional and off by default.

**Architecture:** A deduped company list flows from a new `services/customers.ts` into the form via a lightweight client `CompanyCombobox`. The 統編 lookup is a pure-parse `lib/gcis.ts` + a config-gated `actions/lookup-vat.ts` server action calling the official GCIS open-data API; the "查詢" button renders only when `TW_VAT_LOOKUP` is enabled.

**Tech Stack:** Next.js 16 App Router (Server Actions), TypeScript strict, Drizzle, react-hook-form, next-intl, Jest. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-07-19-customer-entry-acceleration-design.md`

## Global Constraints

- 統編 lookup gated by env `TW_VAT_LOOKUP` (truthy = `"1"`/`"true"`); default OFF. Server action re-checks (defense in depth).
- GCIS API: dataset `5F64D864-61CB-4D0D-8AD9-492047CC1EA6`, OData query, no key. Fields: `Company_Name`, `Company_Location`, `Responsible_Name`, `Company_Status_Desc`, `Business_Accounting_NO`. `fetch` with `AbortSignal.timeout(8000)`.
- No new DB table/migration; dedupe existing `customers` in the query layer (by companyName, latest `id` wins).
- No changes to money/tax math, PDF, or the current visual style (A).
- Every task ends green: `npm test` && `npx tsc --noEmit` && `npm run lint` (lint exits 0; pre-existing `any`/`img` warnings allowed, add no new errors).
- New user-visible strings go into BOTH `messages/en.json` and `messages/zh-TW.json`.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Do NOT push (user decides deploy separately).

---

### Task 1: Config — `features.twVatLookup` + public exposure

**Files:**
- Modify: `lib/config.ts` (AppConfig, PublicAppConfig, getAppConfig, toPublicConfig)
- Test: `tests/unit/lib/config.test.ts`

**Interfaces (Produces):**
- `AppConfig.features: { twVatLookup: boolean }`
- `PublicAppConfig.twVatLookup: boolean`

- [ ] **Step 1: Extend `tests/unit/lib/config.test.ts`** — add to the "no env" test and the "all env" test, plus a public-config assertion:

```ts
  it("defaults twVatLookup to false", () => {
    const config = getAppConfig({});
    expect(config.features.twVatLookup).toBe(false);
  });

  it("enables twVatLookup when TW_VAT_LOOKUP is truthy", () => {
    expect(getAppConfig({ TW_VAT_LOOKUP: "1" }).features.twVatLookup).toBe(true);
    expect(getAppConfig({ TW_VAT_LOOKUP: "true" }).features.twVatLookup).toBe(true);
    expect(getAppConfig({ TW_VAT_LOOKUP: "0" }).features.twVatLookup).toBe(false);
    expect(getAppConfig({ TW_VAT_LOOKUP: "" }).features.twVatLookup).toBe(false);
  });
```

And extend the existing `toPublicConfig` test's expected object to include `twVatLookup: false`.

- [ ] **Step 2: Run — expect FAIL** — `npm test -- tests/unit/lib/config.test.ts` (features undefined).

- [ ] **Step 3: Implement in `lib/config.ts`**
  - Add to `AppConfig` type after `money: {...}`: `features: { twVatLookup: boolean };`
  - Add to `PublicAppConfig`: `twVatLookup: boolean;`
  - In `getAppConfig`, before `return {`, add:

```ts
  const twVat = clean(env.TW_VAT_LOOKUP).toLowerCase();
```

  and add to the returned object:

```ts
    features: {
      twVatLookup: twVat === "1" || twVat === "true",
    },
```

  - In `toPublicConfig`, add `twVatLookup: config.features.twVatLookup,` to the returned object.

- [ ] **Step 4: Run — expect PASS** — `npm test -- tests/unit/lib/config.test.ts`.
- [ ] **Step 5: Verify + commit** — `npx tsc --noEmit && npm run lint`; `git add lib/config.ts tests/unit/lib/config.test.ts && git commit -m "feat(config): TW_VAT_LOOKUP feature flag (default off)"`

---

### Task 2: `lib/gcis.ts` — pure parse + URL builder (TDD)

**Files:**
- Create: `lib/gcis.ts`
- Test: `tests/unit/lib/gcis.test.ts`

**Interfaces (Produces):**
- `type VatCompany = { companyName: string; address: string; responsibleName: string; status: string }`
- `parseGcisResponse(json: unknown): VatCompany | null`
- `gcisUrl(vat: string): string`

- [ ] **Step 1: Write `tests/unit/lib/gcis.test.ts`**

```ts
import { parseGcisResponse, gcisUrl } from "@/lib/gcis";

const SAMPLE = [
  {
    Business_Accounting_NO: "22099131",
    Company_Name: "台灣積體電路製造股份有限公司",
    Company_Location: "新竹科學園區新竹市力行六路8號",
    Responsible_Name: "魏哲家",
    Company_Status_Desc: "核准設立",
  },
];

describe("parseGcisResponse", () => {
  it("maps the first record's fields", () => {
    expect(parseGcisResponse(SAMPLE)).toEqual({
      companyName: "台灣積體電路製造股份有限公司",
      address: "新竹科學園區新竹市力行六路8號",
      responsibleName: "魏哲家",
      status: "核准設立",
    });
  });

  it("returns null for an empty array", () => {
    expect(parseGcisResponse([])).toBeNull();
  });

  it("returns null for non-array / missing company name", () => {
    expect(parseGcisResponse(null)).toBeNull();
    expect(parseGcisResponse({})).toBeNull();
    expect(parseGcisResponse([{ Company_Location: "x" }])).toBeNull();
  });
});

describe("gcisUrl", () => {
  it("builds an OData query filtering by the VAT number", () => {
    const url = gcisUrl("22099131");
    expect(url).toContain("5F64D864-61CB-4D0D-8AD9-492047CC1EA6");
    expect(url).toContain("Business_Accounting_NO");
    expect(url).toContain("22099131");
    expect(url).toContain("$format=json");
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npm test -- tests/unit/lib/gcis.test.ts`.

- [ ] **Step 3: Create `lib/gcis.ts`**

```ts
export type VatCompany = {
  companyName: string;
  address: string;
  responsibleName: string;
  status: string;
};

const DATASET = "5F64D864-61CB-4D0D-8AD9-492047CC1EA6";

export function gcisUrl(vat: string): string {
  const filter = encodeURIComponent(`Business_Accounting_NO eq ${vat}`);
  return `https://data.gcis.nat.gov.tw/od/data/api/${DATASET}?$format=json&$filter=${filter}&$skip=0&$top=1`;
}

export function parseGcisResponse(json: unknown): VatCompany | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const r = json[0] as Record<string, unknown>;
  const companyName = typeof r.Company_Name === "string" ? r.Company_Name : "";
  if (!companyName) return null;
  return {
    companyName,
    address: typeof r.Company_Location === "string" ? r.Company_Location : "",
    responsibleName:
      typeof r.Responsible_Name === "string" ? r.Responsible_Name : "",
    status: typeof r.Company_Status_Desc === "string" ? r.Company_Status_Desc : "",
  };
}
```

- [ ] **Step 4: Run — expect PASS** — `npm test -- tests/unit/lib/gcis.test.ts`.
- [ ] **Step 5: Verify + commit** — `npx tsc --noEmit && npm run lint`; `git add lib/gcis.ts tests/unit/lib/gcis.test.ts && git commit -m "feat(gcis): TW company lookup response parser + URL builder (TDD)"`

---

### Task 3: `actions/lookup-vat.ts` — config-gated server action (TDD)

**Files:**
- Create: `actions/lookup-vat.ts`
- Test: `tests/unit/actions/lookup-vat.test.ts`

**Interfaces:**
- Consumes: `getAppConfig` (Task 1), `parseGcisResponse`, `gcisUrl` (Task 2).
- Produces:
  - `type VatLookupResult = { ok: true; company: VatCompany } | { ok: false; reason: 'DISABLED' | 'INVALID' | 'NOT_FOUND' | 'ERROR' }`
  - `lookupVatNumber(vat: string): Promise<VatLookupResult>`

- [ ] **Step 1: Write `tests/unit/actions/lookup-vat.test.ts`**

```ts
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { lookupVatNumber } from "@/actions/lookup-vat";

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  delete process.env.TW_VAT_LOOKUP;
});

function mockFetchOnce(value: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    json: async () => value,
  }) as unknown as typeof fetch;
}

describe("lookupVatNumber", () => {
  it("returns DISABLED when the flag is off (no fetch)", async () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    const res = await lookupVatNumber("22099131");
    expect(res).toEqual({ ok: false, reason: "DISABLED" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns INVALID for a non-8-digit VAT", async () => {
    process.env.TW_VAT_LOOKUP = "1";
    expect(await lookupVatNumber("123")).toEqual({ ok: false, reason: "INVALID" });
    expect(await lookupVatNumber("abcdefgh")).toEqual({ ok: false, reason: "INVALID" });
  });

  it("returns NOT_FOUND for an empty result set", async () => {
    process.env.TW_VAT_LOOKUP = "1";
    mockFetchOnce([]);
    expect(await lookupVatNumber("00000000")).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("returns ok with the mapped company on success", async () => {
    process.env.TW_VAT_LOOKUP = "1";
    mockFetchOnce([
      { Company_Name: "台積電", Company_Location: "新竹", Responsible_Name: "魏", Company_Status_Desc: "核准設立" },
    ]);
    const res = await lookupVatNumber("22099131");
    expect(res).toEqual({
      ok: true,
      company: { companyName: "台積電", address: "新竹", responsibleName: "魏", status: "核准設立" },
    });
  });

  it("returns ERROR on non-2xx", async () => {
    process.env.TW_VAT_LOOKUP = "1";
    mockFetchOnce([], false);
    expect(await lookupVatNumber("22099131")).toEqual({ ok: false, reason: "ERROR" });
  });

  it("returns ERROR when fetch throws", async () => {
    process.env.TW_VAT_LOOKUP = "1";
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("net")) as unknown as typeof fetch;
    expect(await lookupVatNumber("22099131")).toEqual({ ok: false, reason: "ERROR" });
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npm test -- tests/unit/actions/lookup-vat.test.ts`.

- [ ] **Step 3: Create `actions/lookup-vat.ts`**

```ts
"use server";

import { getAppConfig } from "@/lib/config";
import { gcisUrl, parseGcisResponse, type VatCompany } from "@/lib/gcis";

export type VatLookupResult =
  | { ok: true; company: VatCompany }
  | { ok: false; reason: "DISABLED" | "INVALID" | "NOT_FOUND" | "ERROR" };

export async function lookupVatNumber(vat: string): Promise<VatLookupResult> {
  if (!getAppConfig().features.twVatLookup) {
    return { ok: false, reason: "DISABLED" };
  }
  const clean = (vat ?? "").trim();
  if (!/^\d{8}$/.test(clean)) {
    return { ok: false, reason: "INVALID" };
  }
  try {
    const res = await fetch(gcisUrl(clean), {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, reason: "ERROR" };
    const company = parseGcisResponse(await res.json());
    if (!company) return { ok: false, reason: "NOT_FOUND" };
    return { ok: true, company };
  } catch (err) {
    console.error("lookupVatNumber failed:", err);
    return { ok: false, reason: "ERROR" };
  }
}
```

- [ ] **Step 4: Run — expect PASS** — `npm test -- tests/unit/actions/lookup-vat.test.ts`.
- [ ] **Step 5: Verify + commit** — `npx tsc --noEmit && npm run lint`; `git add actions/lookup-vat.ts tests/unit/actions/lookup-vat.test.ts && git commit -m "feat(vat): config-gated 統編 lookup server action (TDD)"`

---

### Task 4: `services/customers.ts` — deduped company options

**Files:**
- Create: `services/customers.ts`

**Interfaces (Produces):**
- `type CustomerOption = { companyName: string; contactPerson: string | null; email: string | null; phone: string | null; vatNumber: string | null; address: string | null }`
- `getCustomerOptions(): Promise<CustomerOption[]>` — latest row per companyName, max 500.

- [ ] **Step 1: Create `services/customers.ts`**

```ts
import { db } from "@/db";
import { customers } from "@/db/schema";
import { desc } from "drizzle-orm";

export type CustomerOption = {
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  address: string | null;
};

export async function getCustomerOptions(): Promise<CustomerOption[]> {
  // createQuote inserts a new customer per quote, so dedupe by companyName
  // keeping the most recent row (highest id).
  const rows = await db
    .select({
      companyName: customers.companyName,
      contactPerson: customers.contactPerson,
      email: customers.email,
      phone: customers.phone,
      vatNumber: customers.vatNumber,
      address: customers.address,
    })
    .from(customers)
    .orderBy(desc(customers.id))
    .limit(2000);

  const seen = new Set<string>();
  const options: CustomerOption[] = [];
  for (const r of rows) {
    const key = r.companyName?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push(r);
    if (options.length >= 500) break;
  }
  return options;
}
```

- [ ] **Step 2: Verify + commit** — `npx tsc --noEmit && npm run lint && npm test`; `git add services/customers.ts && git commit -m "feat(customers): deduped company options query"`

---

### Task 5: `components/company-combobox.tsx` — lightweight autocomplete

**Files:**
- Create: `components/company-combobox.tsx`

**Interfaces:**
- Consumes: `CustomerOption` (Task 4).
- Produces: `<CompanyCombobox value onChange onSelect options disabled id />`.

- [ ] **Step 1: Create `components/company-combobox.tsx`**

```tsx
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
          // delay so a click on an option registers first
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
                  // prevent input blur before click
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
```

- [ ] **Step 2: Verify + commit** — `npx tsc --noEmit && npm run lint && npm test`; `git add components/company-combobox.tsx && git commit -m "feat(ui): lightweight company autocomplete combobox"`

---

### Task 6: Wire into the quote form (combobox + 統編 lookup) + pages + i18n + env

**Files:**
- Modify: `components/quote-form.tsx`
- Modify: `app/[locale]/quotes/new/page.tsx`
- Modify: `app/[locale]/quotes/[id]/edit/page.tsx`
- Modify: `messages/en.json`, `messages/zh-TW.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `CompanyCombobox` (Task 5), `getCustomerOptions`/`CustomerOption` (Task 4), `lookupVatNumber` (Task 3), `useAppConfig` (existing).

- [ ] **Step 1: `components/quote-form.tsx` — imports & prop**
  - Add imports:

```tsx
import { Controller } from "react-hook-form";
import { CompanyCombobox } from "@/components/company-combobox";
import { lookupVatNumber } from "@/actions/lookup-vat";
import { Search, Loader2 } from "lucide-react";
import type { CustomerOption } from "@/services/customers";
```

  - Change the component signature/props:

```tsx
interface QuoteFormProps {
  initialData: Partial<QuoteFormData> & { id?: number };
  companyOptions?: CustomerOption[];
}

export default function QuoteForm({ initialData, companyOptions = [] }: QuoteFormProps) {
```

  - Inside the component add lookup state and the config flag (near the other hooks):

```tsx
  const { currency, defaultTaxRate, twVatLookup } = useAppConfig();
  const [vatLoading, setVatLoading] = useState(false);
```

  (replace the existing `const { currency, defaultTaxRate } = useAppConfig();` line).

- [ ] **Step 2: `components/quote-form.tsx` — replace the company-name FormField with the combobox** — find the first `<FormField label={t("fields.companyName")} name="companyName" .../>` and replace it with:

```tsx
          <div className="space-y-2">
            <label className="flex items-center gap-1 text-sm font-medium">
              {t("fields.companyName")}
              <span className="text-destructive">*</span>
            </label>
            <Controller
              name="companyName"
              control={form.control}
              render={({ field }) => (
                <CompanyCombobox
                  id="companyName"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  options={companyOptions}
                  disabled={isPending}
                  placeholder="Acme Corp."
                  onSelect={(o) => {
                    form.setValue("companyName", o.companyName, { shouldDirty: true, shouldValidate: true });
                    form.setValue("contactPerson", o.contactPerson ?? "", { shouldDirty: true });
                    form.setValue("email", o.email ?? "", { shouldDirty: true });
                    form.setValue("phone", o.phone ?? "", { shouldDirty: true });
                    form.setValue("vatNumber", o.vatNumber ?? "", { shouldDirty: true });
                    form.setValue("address", o.address ?? "", { shouldDirty: true });
                  }}
                />
              )}
            />
            {form.formState.errors.companyName && (
              <p className="text-xs font-medium text-destructive">
                {form.formState.errors.companyName.message}
              </p>
            )}
          </div>
```

- [ ] **Step 3: `components/quote-form.tsx` — 統編 field with lookup button** — replace the `vatNumber` `<FormField .../>` with a labelled row that adds the button when enabled:

```tsx
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("fields.vatNumber")}</label>
            <div className="flex gap-2">
              <Input
                {...form.register("vatNumber")}
                disabled={isPending}
                className={form.formState.errors.vatNumber ? "border-destructive" : ""}
              />
              {twVatLookup && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending || vatLoading}
                  onClick={async () => {
                    setVatLoading(true);
                    try {
                      const res = await lookupVatNumber(form.getValues("vatNumber") || "");
                      if (res.ok) {
                        form.setValue("companyName", res.company.companyName, { shouldDirty: true, shouldValidate: true });
                        if (res.company.address) form.setValue("address", res.company.address, { shouldDirty: true });
                        if (!form.getValues("contactPerson") && res.company.responsibleName) {
                          form.setValue("contactPerson", res.company.responsibleName, { shouldDirty: true });
                        }
                        toast.success(t("vatLookup.filled"));
                      } else {
                        const key = res.reason === "INVALID" ? "invalid" : res.reason === "NOT_FOUND" ? "notFound" : "error";
                        toast.error(t(`vatLookup.${key}`));
                      }
                    } finally {
                      setVatLoading(false);
                    }
                  }}
                >
                  {vatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="ml-1 hidden sm:inline">{t("vatLookup.button")}</span>
                </Button>
              )}
            </div>
          </div>
```

  (`Input` and `Button` are already imported in this file.)

- [ ] **Step 4: i18n** — add to `QuoteForm` namespace in BOTH message files:
  - `messages/en.json` under `QuoteForm`: `"vatLookup": { "button": "Look up", "filled": "Company details filled from VAT number", "invalid": "Enter an 8-digit VAT number", "notFound": "No company found for this VAT number", "error": "Lookup failed — try again or enter manually" }`
  - `messages/zh-TW.json` under `QuoteForm`: `"vatLookup": { "button": "查詢", "filled": "已用統編帶入公司資料", "invalid": "請輸入 8 位數統編", "notFound": "查無此統編", "error": "查詢失敗,請稍後再試或手動輸入" }`

- [ ] **Step 5: Pages fetch options** — `app/[locale]/quotes/new/page.tsx`: make it `async`, import `getCustomerOptions`, and pass:

```tsx
import { getCustomerOptions } from "@/services/customers";
// ...
export default async function NewQuotePage() {
  const companyOptions = await getCustomerOptions();
  const defaultValues = { /* unchanged */ };
  return (
    <div className="container mx-auto">
      <QuoteForm initialData={defaultValues} companyOptions={companyOptions} />
    </div>
  );
}
```

  (`getAppConfig().money.defaultTaxRate` line stays; `dynamic = "force-dynamic"` stays.)

  `app/[locale]/quotes/[id]/edit/page.tsx` (already async): add `import { getCustomerOptions } from "@/services/customers";`, fetch `const companyOptions = await getCustomerOptions();` after loading the quote, and pass `companyOptions={companyOptions}` to `<QuoteForm ...>`.

- [ ] **Step 6: `.env.example`** — under the Money section (or a new "Regional features" comment) add:

```
# --- Regional features (optional) ---
# Enable Taiwan 統編 (VAT) lookup button in the quote form (uses the public
# GCIS open-data API). Leave empty to disable. Taiwan-only.
TW_VAT_LOOKUP=
```

- [ ] **Step 7: Verify** — `npm test && npx tsc --noEmit && npm run lint` all green.
- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(quotes): company autocomplete + optional 統編 lookup in the form"`

---

### Task 7: End-to-end verification (preview harness)

- [ ] **Step 1: Green gate** — `npm test && npx tsc --noEmit && npm run lint`.
- [ ] **Step 2: Start preview harness** with `TW_VAT_LOOKUP=1` and seeded companies (reuse the harness from the UI plan; add `TW_VAT_LOOKUP=1` to the `npm run dev` env):

```bash
DATABASE_URL="postgres://postgres:postgres@localhost:55440/quote-system" TW_VAT_LOOKUP=1 PORT=3700 npm run dev
```

- [ ] **Step 3: Combobox (playwright)** — at `/zh-TW/quotes/new`, type part of a seeded company name in the company field → dropdown lists matches → click one → confirm companyName/contact/email/phone/vat/address all fill.
- [ ] **Step 4: 統編 lookup** — clear company, type `22099131` in the 統編 field, click 查詢 → companyName becomes "台灣積體電路製造股份有限公司", address fills; toast success. (Requires outbound internet from the dev machine.)
- [ ] **Step 5: Flag off** — restart dev without `TW_VAT_LOOKUP` → the 查詢 button is absent; combobox still works.
- [ ] **Step 6: Dark mode** — combobox dropdown readable in dark.
- [ ] **Step 7: Cleanup** — stop dev, `docker rm -f ui-preview-db`; `git status` clean.
- [ ] **Step 8: Report** — summarize; note the author must set `TW_VAT_LOOKUP=1` in `/opt/quote-system/.env` on the homelab for the button to appear after deploy.

---

## Self-Review

**1. Spec coverage:**
- Existing-company picker (service + combobox + form wiring) → Tasks 4, 5, 6 ✓
- 統編 lookup (config gate + GCIS parse + action + button) → Tasks 1, 2, 3, 6 ✓
- Config gating / open-source cleanliness → Task 1 (+ `.env.example` Task 6) ✓
- Error handling (disabled/invalid/not-found/error, combobox no-match) → Task 3 + Task 6 toasts ✓
- Testing (parse pure fn, action, config) → Tasks 1–3 TDD; visual → Task 7 ✓
- YAGNI (no migration, no CRUD page, no cache) → honored; dedupe in query (Task 4) ✓

**2. Placeholder scan:** No TBD/TODO; every code/step is concrete.

**3. Type consistency:** `CustomerOption` (Task 4) used in Tasks 5–6. `VatCompany`/`VatLookupResult` (Tasks 2–3) used in Task 6. `features.twVatLookup` (Task 1) read by Task 3 action and exposed as `twVatLookup` (PublicAppConfig) consumed by Task 6 form. `lookupVatNumber(vat): VatLookupResult` signature consistent across Tasks 3 and 6.
