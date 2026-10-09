# Quote System v1.0 — Invoify merge, PWA, optimisation, distributable packaging

**Date**: 2026-10-09 · **Branch**: `claude/kind-planck-wag9ma`

## 0. Goal

Turn the internal quote tool into a product other small businesses can self-host:

1. Borrow the best parts of the most-starred comparable open-source project.
2. Make it an installable, offline-tolerant **PWA**.
3. Optimise it (security, DB, bundle, image size).
4. Make the **UI/UX** genuinely good on phone and desktop.
5. **Package** it so a non-developer can install it with one command, and configure it in the app instead of editing env files.

### Reference project

| Project | Stars | Licence | Stack | Use |
|---|---|---|---|---|
| **Invoify** (al1abb/invoify) | ~6.3k | MIT | Next.js + shadcn + RHF + zod + next-intl (same as ours) | **Primary reference.** Patterns and small helpers may be adapted, with attribution in `THIRD_PARTY_NOTICES.md` and a header comment on adapted files. |
| Invoice Ninja | ~10k | Elastic-2.0 | Laravel/Flutter | Most-starred overall in invoicing, but source-available. **Feature ideas only, no code.** |

Ported from Invoify (adapted to our DB-backed model): live A4 preview with fit-to-width scaling and click-to-edit, mobile preview sheet + sticky mobile action bar, draft autosave with indicator and restore, one-tap payment-term / validity presets, duplicate ("load") quote, item description + reorder, document-level discount and fees with amount/percent toggle, accent colour theming, rate limiting + request validation, safe-area utilities, Playwright smoke-test helpers. **Not** ported: Puppeteer PDF (no CJK, +300 MB), voice input, signature drawing, 13 templates.

Ideas from Invoice Ninja / Crater / InvoicePlane (no code): status lifecycle with activity log, configurable numbering, dashboard pipeline KPIs, CSV export, product suggestions from past items, customer directory.

### Out of scope (documented as roadmap)

Public share/accept links, quote → invoice conversion, multi-currency per quote, multiple users/roles, SMTP (Resend only), offline *editing*.

## 1. URL map

| Path | Notes |
|---|---|
| `/[locale]` | Dashboard (`en`, `zh-TW`; default `en`, Accept-Language negotiated) |
| `/[locale]/quotes` | List: `?q=&status=draft\|sent\|accepted\|rejected\|expired&sort=newest\|oldest\|amount_desc\|amount_asc\|valid_until&page=` |
| `/[locale]/quotes/new` | `?from=<id>` duplicates a quote into the form; `?customer=<name>` prefills from the latest customer row |
| `/[locale]/quotes/[id]` · `/edit` | Detail / edit |
| `/[locale]/customers` | Customer directory `?q=` |
| `/[locale]/settings` | Settings |
| `/[locale]/login` | Only when `APP_PASSWORD` is set |
| `/api/quotes/[id]/pdf` | `?lang=en\|zh-TW` (default: NEXT_LOCALE cookie → default), `?download=1` → attachment, else inline |
| `/api/export/quotes` | CSV (UTF-8 BOM) honouring the list filters |
| `/api/branding/[kind]` | `logo\|stamp\|icon` image; `?v=<version>` → immutable cache. `/api/branding-icon` kept as an alias. |
| `/api/health` | `SELECT 1` → `{status:"ok"}` / 503. Public. |
| `/api/auth/login` · `/api/auth/logout` | Public (form POST) |
| `/manifest.webmanifest`, `/sw.js`, `/offline.html`, `/icons/<file>.png` | Public PWA assets (dotted paths are skipped by the proxy matcher) |

Locale validation: the `[locale]` layout calls `hasLocale` → `notFound()`, `generateStaticParams`, `dynamicParams = false`; `app/[locale]/[...rest]/page.tsx` → `notFound()`. **Never** expose private data at a path ending in `.<ext>` (the proxy skips those).

## 2. Auth (optional, off by default)

- Enabled iff `APP_PASSWORD` is non-empty. `AUTH_SECRET` (≥32 chars) signs sessions; if unset, derive from APP_PASSWORD with a warning log.
- Token `v1.<exp>.<b64url(HMAC-SHA256)>`, key = SHA-256(`AUTH_SECRET \0 APP_PASSWORD`), 30 days, cookie `qs_session` httpOnly, SameSite=Lax, `Secure` when `x-forwarded-proto: https`.
- `proxy.ts` matcher `/((?!_next/static|_next/image|.*\\.\\w+$).*)`. Public: `/api/health`, `/api/auth/*`, `/api/branding/*`, `/api/branding-icon`, `/<locale>/login`. Requests with a `next-action` header are never public. Unauthenticated: `/api/*` and actions → 401, pages → 307 to `/<locale>/login?next=`.
- Defence in depth: `assertAuthenticated()` (`lib/auth/guard.ts`) is the first call in **every** server action and private route handler.
- Login: same-origin check, in-memory throttle (5 failures / 15 min / IP), `safeNextPath()` against open redirects. Logout clears the cookie (and the client clears SW caches).
- `install.sh` generates a random `APP_PASSWORD` so new installs are protected by default; existing deployments without it keep working.

## 3. Data model v2 (`db/schema.ts`, migration `0001`)

Already committed. Key points:

- Money columns are `bigint` cents; `quotation_items.quantity` is `numeric(12,3)`; items have `position`, `description`, `unit`.
- `quotations`: `title`, `discount_type ('amount'|'percent')`, `discount_value` (cents or bp), `discount_amount` (cents, computed), `terms`, `sent_at`, `decided_at`, `updated_at`. `other_fees` = untaxed fees added after tax. `payment_method` is shown as **付款條件 / Payment terms**, `shipping_method` as **交貨方式 / Delivery**, `shipping_date` as **交貨日期 / Delivery date**.
- New tables: `quote_events`, `quote_counters`, `app_settings` (single row id=1, jsonb), `branding_assets` (kind pk, mime, base64).
- Customers stay a **per-quote snapshot** (one row per quote). The directory groups by `lower(btrim(company_name))` and picks the newest row. Deleting a quote deletes its customer row when nothing else references it.
- Item reads always `orderBy: [asc(position), asc(id)]`.

## 4. Money rules (`lib/money.ts`)

- Storage: cents (×100) for every currency. Display fraction digits: `currencyFractionDigits(currency)` = 0 for TWD, JPY, KRW, VND, CLP, ISK, HUF, UGX; else `Intl.NumberFormat(..).resolvedOptions().maximumFractionDigits` (fallback 2). Inputs use `inputMode="decimal"`, `step="any"`, validated to ≤ 2 decimals.
- `toCents(major) = Math.round(major * 100)`. Line amount = `Math.round(quantity * unitPriceCents)`.
- `calculateQuoteFinancials(items, { taxRateBp, discount: { type, value }, otherFees })`, all integer:
  1. `subtotal = Σ line`, `taxableSubtotal = Σ line where isTaxable ?? true`
  2. `discount = percent ? round(subtotal * bp / 10000) : value`, clamped to `[0, subtotal]`
  3. `taxBase = taxableSubtotal - (subtotal > 0 ? round(discount * taxableSubtotal / subtotal) : 0)`
  4. `tax = round(taxBase * taxRateBp / 10000)`
  5. `total = subtotal - discount + tax + otherFees`

  Returns `{ subtotal, taxableSubtotal, discount, taxBase, tax, otherFees, total }`. The old 2-arg signature stays as a wrapper so the old tests keep passing.
- Tax rate 0–100 %, ≤ 2 decimals. Quantity > 0, ≤ 3 decimals, ≤ 1e9. Unit price ≥ 0, ≤ 1e12.
- `amountInWordsZhTW(cents)` → `新台幣壹萬貳仟參佰元整` (with 角/分 only when there are cents); `amountInWordsEn` simple fallback.
- One formatter everywhere: `formatMoney(cents, { currency, currencyLocale, fractionDigits })`. The UI locale never changes money formatting.

## 5. Quote numbering (`lib/quote-number.ts`)

- Pattern setting, default `QT-{YYYY}{MM}{DD}-{SEQ:3}`. Tokens: `{YYYY} {YY} {ROC}` (民國年 = year − 1911) `{MM} {DD} {SEQ}` / `{SEQ:n}` (zero-pad). It must contain exactly one SEQ token.
- The date comes from the quote's `issuedDate` (a `YYYY-MM-DD` string, already in the business timezone), not the server clock.
- Scope = the pattern rendered with the SEQ token removed (e.g. `QT-20261009-`). Inside the create transaction: `INSERT INTO quote_counters(scope, value) VALUES (scope, <max existing seq for numbers matching the rendered prefix/suffix> + 1) ON CONFLICT (scope) DO UPDATE SET value = quote_counters.value + 1 RETURNING value`. If the resulting number already exists (legacy/manual data), bump again (max 20 tries).

## 6. Settings (`lib/settings/*`, `services/settings.ts`, `actions/settings.ts`)

Precedence: **DB (Settings page) > env vars > built-in defaults**, per field. A field counts as set in the DB only if it was explicitly saved (empty string = "clear to hidden" for optional text fields, which is a valid saved value).

```ts
type EffectiveSettings = {
  company: { name; nameLocal; address; vatNumber; email; phone; website; isDefault: boolean };
  payment: { bankName; bankCode; accountName; accountNumber } | null;   // null when all empty
  quote: { numberPattern; validityDays /*30*/; defaultTaxRate /*5*/; defaultNotes; defaultTerms;
           defaultSalesperson; showAmountInWords /*true for TWD*/; footerText };
  money: { currency /*TWD*/; currencyLocale /*zh-TW*/; fractionDigits };
  appearance: { brandColor /*#1D4ED8*/ };
  region: { timezone /*APP_TIMEZONE || TZ || Asia/Taipei*/ };
  mail: { enabled; apiKey /*env RESEND_API_KEY only, never sent to client*/; senderName; senderEmail; ccEmails: string[]; replyTo };
  features: { twVatLookup };
  auth: { enabled };
  version: string;   // changes whenever settings or branding change (cache busting)
};
getSettings(): Promise<EffectiveSettings>            // React cache() per request + 15 s in-process TTL, invalidated on save
getPublicConfig(): Promise<PublicAppConfig>         // client-safe subset (no apiKey)
getDocumentBranding(mode: "html" | "pdf"): Promise<DocumentBranding>   // html → logo URLs, pdf → data URIs
getBrandingAsset(kind): Promise<{ data: Buffer; mime: string; version: string } | null>  // DB → branding/<kind>.png → branding-defaults
saveSettings(section, data) / uploadBrandingAsset(formData) / deleteBrandingAsset(kind)    // server actions
```

`getAppConfig(env)` (env-only, sync) stays for backward compatibility and tests. Uploads: PNG/JPEG only (react-pdf supports both), ≤ 1 MB, magic-byte check. Brand colour `/^#[0-9a-fA-F]{6}$/` drives the UI primary colour (CSS vars, with a lighter dark-mode variant and a readable foreground), the PDF accent, the top loader and the manifest `theme_color`.

## 7. Shared view model (`lib/quote-view.ts`)

```ts
type QuoteView = {
  id: number | null; quotationNumber: string | null; title: string | null;
  status: QuoteStatus; displayStatus: QuoteStatus | "expired";
  issuedDate: string; validUntil: string;           // YYYY-MM-DD
  salesperson: string;
  customer: { companyName; contactPerson; email; phone; address; vatNumber };   // string | null
  items: { productName; description; unit; quantity; unitPrice /*cents*/; isTaxable; amount /*cents*/ }[];
  taxRate: number;                                     // percent, e.g. 5
  discount: { type: "amount" | "percent"; value: number };   // major units or percent
  totals: { subtotal; discount; taxBase; tax; otherFees; total };   // cents
  paymentTerms; deliveryMethod; deliveryDate; notes; terms;  // string | null
};
quoteViewFromRecord(row, { today }) / quoteViewFromForm(values, { today })
```

`components/quote-document/quote-document.tsx` (HTML A4, client-safe, used by the detail page **and** the live preview) and `components/pdf/QuotePDFDocument.tsx` both render a `QuoteView` + `DocumentBranding` + labels, so preview, page and PDF cannot drift. Expired = status ∈ {draft, sent} and `validUntil < today` in the business timezone; accepted/rejected never show as expired.

## 8. i18n

- `messages/<locale>/<Namespace>.json`; register new namespaces in `i18n/messages.ts`. `tests/unit/i18n/messages.test.ts` enforces identical keys across locales.
- zh-TW copy must read like natural Taiwanese business Mandarin (報價單, 統一編號, 付款條件, 含稅/未稅, 有效期限, 已成交…), with full-width punctuation.
- zod messages are **keys** into the `Validation` namespace (e.g. `required`, `invalidEmail`, `itemsRequired`); UI renders `t(\`Validation.${message}\`)`.
- No hard-coded user-visible English anywhere (including `aria-label`, `title`, PDF, email, error pages).

## 9. PWA

- `app/manifest.ts` (`force-dynamic`): `id:"/"`, `start_url:"/"`, `scope:"/"`, `display:"standalone"`, name = `APP_NAME` env || company local/main name || "Quote System" (**not** locale-dependent; identity changes need user approval in Chrome), `short_name` ≤ 12 chars, `theme_color` = brand colour, `background_color` `#ffffff`, `categories`, icons `/icons/any-192.png?v=` `/icons/any-512.png?v=` `/icons/maskable-192.png?v=` `/icons/maskable-512.png?v=` (separate `any` and `maskable` entries), shortcuts (New quote → `/quotes/new`, Quotes → `/quotes`; the proxy redirects unprefixed paths to a locale).
- `app/icons/[file]/route.tsx`: `next/og` `ImageResponse` (no sharp) renders the branding icon onto 192/512 canvases; maskable uses a 0.55 safe-zone scale on a solid background; `apple-180.png` opaque. In-memory memo by `file + version`. `?v=` → `immutable`.
- `app/sw.js/route.ts`: hand-written worker (no Serwist — webpack-only / experimental on Turbopack, and its defaults would precache 14 MB fonts and cache DB pages). Build ID inlined from `.next/BUILD_ID`. Headers `Content-Type: application/javascript`, `Cache-Control: no-cache, no-store, must-revalidate`, `Service-Worker-Allowed: /`. Strategy: `/_next/static/*` cache-first; navigations network-first (navigation preload) → fallback `/offline.html`; **never** cache `/api/*`, PDFs, RSC payloads, server actions (non-GET). Old caches deleted on activate. `SKIP_WAITING` message.
- `app/offline.html/route.ts`: self-contained bilingual HTML (inline CSS, light/dark, logo data URI, Retry button).
- Client: `components/pwa/*` — `PwaRoot` (registers SW in production, update toast "New version available — Reload", hourly + on-visible `reg.update()`, offline banner, theme-color sync), `InstallAppButton` (beforeinstallprompt; iOS/iPadOS "Share → Add to Home Screen" popover; hidden in standalone).
- Layout metadata: `viewport { viewportFit: "cover", themeColor }`, `appleWebApp { capable, title, statusBarStyle: "default" }`, `icons.apple`, `robots: noindex`. Safe-area utilities `.pb-safe`, `.pt-safe`, `.px-safe`.
- HTTPS is required to install (except localhost): docs + Caddy profile (`tls internal` or real domain), Tailscale / Cloudflare Tunnel alternatives.

## 10. UI/UX

- **Shell**: top nav (Dashboard, Quotes, Customers, Settings; right: install, language, theme, logout). Phones: bottom tab bar (Dashboard, Quotes, **＋ New**, Customers, Settings) with safe-area padding; standalone mode feels native. Theme follows the system by default. Themed toaster. Skip link. Per-route skeletons, `error.tsx`, `not-found.tsx`.
- **Dashboard**: KPI cards (open pipeline = sent & not expired, accepted this month, acceptance rate over 90 days, drafts), expiring-in-7-days list, recent quotes, setup checklist when company info / logo / first quote / install are missing.
- **Quotes list**: debounced search, status chips with counts, sort, CSV export, row actions (view, edit, duplicate, delete), tappable mobile cards.
- **Customers**: directory with quote count, accepted total, last quote; "New quote for this customer", "View quotes".
- **Quote form**: sections Customer · Quote info · Items · Totals · Terms, with a sticky section index showing ✓/! state (desktop). Items: description, unit (datalist 式/個/組/台/小時/天/月/次), decimal qty, taxable toggle, reorder up/down, duplicate/remove, product suggestions from past items. Discount (amount/%) and other fees behind "+ Add discount / + Add fee". Validity presets (+7/+14/+30/+60). Payment-term presets (月結30天, 月結60天, 貨到付款, 訂金50%，交貨付清, 匯款). Desktop (≥1280px): live A4 preview pane (debounced, fit-to-width, click-to-edit). Phones: sticky bottom bar (total, Preview sheet, Save). Autosave drafts (localStorage, debounced 600 ms, flushed on pagehide/visibilitychange) with "Saved · 2m" indicator and a restore banner; `beforeunload` guard while dirty; Ctrl/⌘+S saves; server field errors mapped back with `setError`; after create → go to the new quote.
- **Quote detail**: header (number, title, status, customer, total), primary actions Download PDF + Send; overflow: Edit, Duplicate, Mark as sent/accepted/rejected/draft, Print, Share (Web Share API with the PDF file where supported, else copy link), Delete (last, red). Phones: sticky action bar. Document scaled to fit width with a 100% toggle. Activity timeline. Send dialog with editable recipient, CC and message.
- **Settings**: Company · Branding (logo/stamp/icon upload with preview, brand colour presets + picker) · Quotes (numbering pattern with live preview, validity days, default tax, notes, terms, salesperson, amount in words, footer) · Payment · Email (sender name/email/CC/reply-to; API key status from env) · Regional (currency, money locale, timezone, TW 統編 lookup) · About (version, install app, backup instructions).
- **Accessibility**: labels linked to inputs, `aria-invalid`/`aria-describedby`, named icon buttons, ARIA combobox, `aria-current`, `<Button asChild><Link/></Button>` (no `<a><button>`), contrast ≥ 4.5:1, focus-visible ring, reduced motion.

## 11. Optimisation

- DB pool `DB_POOL_MAX` (default 10) + dev `globalThis` singleton; indexes in 0001; dashboard KPIs in one `FILTER` query; server-side customer/product search (no more shipping 500 customers to the browser); `updated_at`-keyed LRU PDF cache (8 entries / 16 MB) with `X-Pdf-Cache`; PDF fonts (Regular **and Bold**) moved out of `public/` into `assets/fonts`, registered once in `lib/pdf/fonts.ts`.
- `next.config.ts`: `poweredByHeader: false`, `images.unoptimized`, `outputFileTracingExcludes` (typescript, sharp, @img), `outputFileTracingIncludes` for fonts + migrations, security headers (nosniff, Referrer-Policy, X-Frame-Options DENY / frame-ancestors 'none', Permissions-Policy), `/sw.js` headers.
- Form re-renders isolated (`useWatch` in leaf components), preview mounted only when visible, `next/dynamic` for the preview/sheet.

## 12. Packaging

- `instrumentation.ts` → `lib/db/migrate.ts`: migrate on boot under `pg_advisory_lock`, transient-error retry, `process.exit(1)` on failure, `SKIP_DB_MIGRATIONS=true` escape hatch. `npm run db:migrate` for dev.
- `Dockerfile`: `--platform=$BUILDPLATFORM` build stages (cross-arch without QEMU), `NEXT_TELEMETRY_DISABLED`, root-owned app files, `USER node`, `HEALTHCHECK` on `/api/health`, copies `drizzle/` + `assets/`, `.dockerignore` (never bake `.env`).
- `deploy/` bundle: `docker-compose.yml` (prebuilt `ghcr.io/sychen6192/quote-system:${QUOTE_VERSION}`, db healthcheck, no published 5432, app healthcheck, profiles `https` (Caddy) and `backup` (pg_dump loop)), `Caddyfile`, `.env.example`, `install.sh` (checks docker, downloads release bundle + SHA256SUMS, generates `.env` with random `POSTGRES_PASSWORD`, `AUTH_SECRET`, `APP_PASSWORD` once, `docker compose up -d --wait`).
- Root `docker-compose.yaml` (build from source) aligned: healthchecks, no 5432 on 0.0.0.0, compose-network DATABASE_URL.
- CI: `ci` job with a Postgres service: migrations-up-to-date check, lint, typecheck, unit tests, build, boot standalone twice against Postgres (migrations idempotent) → `/api/health`; `e2e` Playwright job; `image` job multi-arch (amd64+arm64) with metadata-action semver tags, OCI labels, provenance; `release` job on `v*.*.*` tags uploads the deploy bundle; homelab `deploy` job keeps working (drizzle push step removed — the app migrates itself; health check → `/api/health`).
- Docs: README (en) + README.zh-TW rewritten around "Install in 5 minutes", configuration, HTTPS/PWA install on phones, backup/restore, upgrading, security; `THIRD_PARTY_NOTICES.md` (Invoify MIT, Noto Sans TC OFL); `CHANGELOG.md`; version `1.0.0`.

## 13. Quality gates (every wave)

`npx tsc --noEmit` · `npm run lint` (0 errors, no new warnings) · `npm test` · `npm run build` · migrations apply on a fresh DB and on a legacy push-created DB · Playwright smoke (desktop + 375px mobile, both locales, no console errors, no horizontal overflow, PDF magic bytes, manifest installable via CDP, offline fallback) · Docker image builds and passes its healthcheck.
