# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [Unreleased]

### Fixed

- **Date fields no longer stick out of their card on iPhone.** Safari gave the issue date, valid-until and delivery date fields its own native frame and a minimum width, so on phones they ran past the right edge of the form card, came out taller than the other fields and centred the date. They now size and align like every other input; tapping still opens the iOS date picker.

## [1.0.1] - 2026-10-10

Fixes from a security, data and usability review of 1.0.0. Upgrading is recommended for every install; read the upgrade notes at the end of this section first.

### Security

- **Quotes and settings leaked through `/_next/…` URLs.** Next.js rendered pages such as `/_next/quotes/1` or `/_next/settings` (with the bank account) into the body of a 404, also for visitors who were not signed in. Everything under `/_next/` except Next.js's own files now gets an empty 404.
- **Open redirect after sign-in.** A crafted `next` parameter (`/.//evil.example`, `/%2e//…`) could send people to another site after signing in. It is checked again after dot segments are resolved, and redirects never leave the app's origin.
- **Sign-in throttling can no longer lock everyone out.** A browser that has signed in before carries a signed device cookie and is limited on its own (5 failures per 15 minutes), so guesses from elsewhere never block it. Other browsers are limited per client address and by a shared cap of 30 failed attempts a minute; successful sign-ins no longer count. The address is the `X-Forwarded-For` entry written by the nearest proxy instead of the first one, which the client controls; the new `TRUST_PROXY_HOPS` setting covers chains of several proxies.
- **Optional host-name check with sign-in off (`APP_HOSTS`).** Without `APP_PASSWORD`, a web page could reach the app through DNS rebinding. Set the new `APP_HOSTS` to the names you use, and every other name gets "Unknown host" (HTTP 421); IP addresses, `localhost`, single-label and private names (`.local`, `.lan`, `.home.arpa`…) and `SITE_ADDRESS` always work. The check is opt-in: without `APP_HOSTS` every name is served, and the app logs a warning the first time it is reached under a name that is not local. Sign-in (the installer sets a password) remains the recommended protection.
- **Email and 統編 lookup limits can no longer be dodged with made-up addresses.** They use the same client address as sign-in, and besides the per-address limits (20 emails an hour, 30 lookups a minute) there are now caps for all clients together (50 emails an hour, 60 lookups a minute); a request refused by one limit no longer uses up the other.
- **The sign-in page no longer carries the default salesperson's name** or which features (email, 統編 lookup) are turned on in its page data.
- `robots.txt` and an `X-Robots-Tag: noindex, nofollow` header on every response keep the app, its PDFs and CSV exports out of search engines.

### Fixed: quotes and data

- **Totals add up as printed.** When amounts are shown without cents (TWD by default), line amounts, discount, tax and other fees are rounded to whole dollars before they are added up, in the editor, on the quote page and in the PDF and email. A quote that still holds figures with cents shows cents throughout instead of hiding them.
- **Times are no longer off when PostgreSQL is not set to UTC.** The app's database connections now use UTC; a database in Asia/Taipei used to shift created and updated times by 8 hours. The bundled PostgreSQL uses UTC and was not affected.
- **CSV export includes every quote.** It stopped at 10,000 rows; it now streams all of them in batches.
- **CSV amounts keep their cents.** For a currency shown without cents (TWD), an amount that still holds cents, such as the tax of a quote saved before 1.0.1, is written with two decimals (`16.65`) instead of being rounded (`17`), so each row adds up to its total.
- **"View quotes" for a customer shows exactly that customer.** It used to search by name, so "Acme" also listed "Acme Holdings". The list shows a removable customer filter, and the CSV export follows it.
- **Edits made elsewhere are no longer overwritten silently.** Saving a quote that changed after you opened it offers "Reload latest" (your changes are kept as a draft you can restore) or "Save anyway".
- Quantities above 999,999,999.999 get a field error instead of failing to save.
- A search containing a NUL or other control character no longer causes a server error, and text fields reject NUL characters.
- The quote list and dashboard sort by creation time using its index; migration `0002` gives quotes without a creation time their issue date and makes the column required.
- PDFs wrap long unbroken Latin text (URLs, long words) instead of running past the margin, and size the price and amount columns for very large figures.

### Fixed: installed app

- **The offline page appears behind a reverse proxy.** When Caddy, Cloudflare or a NAS proxy answers 502, 503, 504 or 520–530 because the server is down, the installed app shows its offline page and reloads once the server is back, instead of showing the proxy's error.
- **Signing out deletes the quote drafts** saved in that browser. Drafts are kept when a session simply expires.
- **A placeholder icon is no longer cached for a year.** If the database was unreachable while an icon was requested, the default icon could stick to installed apps; such responses are now cached for 5 minutes, and a short database outage keeps the last good logo and icon.
- The manifest is linked with `crossorigin="use-credentials"`, so browsers send cookies when they fetch it (needed behind a login proxy such as Cloudflare Access).
- With the emergency switch `PWA_DISABLE_SW=true`, the app no longer shows "A new version is ready".
- Opening an API URL, such as a CSV export, in the installed app requests it once instead of twice.

### Fixed: interface and accessibility

- No more false "session expired" message and reload right after saving a quote.
- "Duplicate" and "New quote for this customer" keep their own drafts, so they never overwrite an unsaved new quote (such drafts are deleted after 30 days).
- The chosen language is remembered for a year instead of until the browser closes.
- Download PDF and Export CSV lead to the sign-in page when the session has expired, instead of failing silently.
- After deleting a quote from the list, keyboard focus moves to the next row.
- The price field no longer shows a placeholder 0 that looks like a value, empty rows at the end are dropped when saving, and longer currency codes such as IDR no longer overlap the amount.
- Contrast of at least 4.5:1 for the selected status filter's count, the expired-quote and email notices, warning badges and brand colours (including custom ones, light and dark); dark-mode brand colours are calmer.
- Undo and Retry notifications stay 10 seconds and can be clicked while a dialog is open; the send dialog explains what to do when email is not set up.
- Traditional Chinese wording: 儲存／存放 instead of 保存, and 您 throughout Settings.
- Pages with an unknown language prefix return 404 before loading any data.

### Fixed: installation, upgrades and documentation

- **Restore no longer leaves a mixed schema.** The documented restore now stops the app, recreates an empty database and runs `pg_restore --exit-on-error` into it. The old `pg_restore --clean --if-exists` kept tables and migration records of a newer version, so quotes returned errors or the next upgrade failed to start. A CI drill runs the documented commands against PostgreSQL and starts a newer release on the result.
- **Upgrade instructions that did nothing.** Every install pins an exact `QUOTE_VERSION`, so `docker compose pull && docker compose up -d` alone re-pulled the same image. The guides, the deploy bundle, the installer's summary and the release notes now say to change `QUOTE_VERSION` first (or run the installer again), and give PowerShell users a working upgrade path.
- **The installer upgrades the install you are in.** Run from an install directory, `install.sh` now uses it instead of `~/quote-system`. Before writing anything it checks the existing database: if it belongs to an install elsewhere, it names that directory (`QUOTE_DIR=…`), and it only suggests `docker volume rm` when no container uses the volume.
- **Plain HTTP stays on the server behind Caddy.** When the `https` profile is on (in `COMPOSE_PROFILES`, or Caddy started by hand), the installer sets an empty `APP_BIND` to `127.0.0.1`, so port 3000 cannot be reached around Caddy; an `APP_BIND` you set is kept, with a warning. `COMPOSE_PROFILES=https sh install.sh` turns HTTPS on for a new install. The Cloudflare Tunnel guide now says not to publish port 3000 as well.
- **The contributor `docker-compose.yaml` no longer shares the deploy bundle's database.** A clone in a folder named `quote-system` used the project name `quote-system`, the same volume as an installed bundle, so two PostgreSQL servers could run on one data directory. It is now the project `quote-system-dev`.
- **Database dumps are private.** `install.sh` makes `backups/` mode 700 (also on upgrade), and the backup service writes dumps with mode 600, owned by the owner of `backups/`.
- **Passwords that Compose changed.** `APP_PASSWORD` values with `$` or ` #` were silently shortened by Docker Compose. The docs now list the safe characters (the ones the installer accepts) and how to quote any other password.
- **Installing behind a login proxy.** The HTTPS guide lists the paths Cloudflare Access (or any other login in front of the app) must let through so the app can still be installed.
- The README describes the sign-in throttling as it works, and no longer says the Linux commands work in Windows PowerShell; it points to the PowerShell steps.

### Changed

- `deploy/.env.example` leaves `APP_BIND` empty, which still means every interface (`0.0.0.0`).
- Dependabot groups majors into one weekly pull request and skips those that need a planned migration (Next.js, React, ESLint, Tailwind CSS, TypeScript); `@types/node` stays on the Node.js 22 line used by the image and CI.
- `@types/node` follows Node.js 22 (it was 20). Removed unused packages (`date-fns`, `react-day-picker`, `tw-animate-css`, `@testing-library/*`) and declared `intl-messageformat`, which `npm run lint` uses.

### Upgrade notes

- Take a backup, then upgrade as usual. Migration `0002` runs automatically when the app starts.
- Quotes saved before 1.0.1 keep their stored totals in the quote list, the dashboard and the CSV export until they are edited and saved. Their quote page, PDF and email are calculated again with the new rounding, so for a TWD quote whose figures had cents (often the tax) the list can show a slightly different total than the document. Open and save such a quote to update it.
- Created and updated times that a non-UTC PostgreSQL server wrote before 1.0.1 stay shifted.
- `APP_HOSTS` is opt-in: nothing changes until you set it. With sign-in off and the app reached by a domain name (a NAS reverse proxy, Tailscale's `*.ts.net`, a tunnel), set `APP_PASSWORD` (recommended), or list those names in `APP_HOSTS`; until then the log shows a warning.
- Every browser counts as new for sign-in throttling until it signs in once with 1.0.1.
- Installs created with 1.0.0 have `APP_BIND=0.0.0.0` in `.env`. If you use the `https` profile, set `APP_BIND=127.0.0.1` and run `docker compose up -d`; the installer warns about it but does not change it.
- If you build from source with the root `docker-compose.yaml`, its database is now the volume `quote-system-dev_postgres_data` and starts empty. Your old data is still in `quote-system_postgres_data`: move to the deploy bundle (see "Upgrading from 0.x" below), or run `COMPOSE_PROJECT_NAME=quote-system docker compose up -d postgres` once, take a `pg_dump`, and restore it into the new stack.

## [1.0.0] - 2026-10-09

The first release meant for other businesses to install. It adds an installable app, in-app settings, optional sign-in and one-command installation, and reworks most of the interface.

### Added

- **Install in one command.** `install.sh` downloads the release bundle, verifies its checksum, creates `.env` with random database password, session secret and sign-in password, and starts everything. Running it again upgrades.
- **Deploy bundle** (`deploy/`): Docker Compose file using the prebuilt image, PostgreSQL with health checks and no published port, an optional `https` profile (Caddy, automatic certificates or its own CA, also for a bare IP address and non-default ports) and an optional `backup` profile (daily `pg_dump` with retention).
- **Installable app (PWA)**: web app manifest and icons generated from your branding, a service worker that caches static assets only, a bilingual offline page, "new version available" prompt, install button and iPhone instructions.
- **Settings page** for company details, branding uploads (logo, stamp, app icon), brand colour, quote numbering, defaults (validity, tax, notes, terms, salesperson, amount in words, PDF footer), payment details, email sender, currency, money format, time zone and the Taiwan 統編 lookup. Saved settings override `.env`.
- **Optional sign-in** with a shared password (`APP_PASSWORD`): signed 30-day session cookie, sign-in throttling, open-redirect protection; every Server Action and private route checks the session.
- **Dashboard** with open pipeline, accepted this month, 90-day acceptance rate, drafts, quotes expiring within 7 days, recent quotes and a setup checklist.
- **Customer directory** with quote count, accepted total and last quote, plus "new quote for this customer".
- **Quote editor**: live A4 preview with fit-to-width scaling and click-to-edit, item descriptions, units, decimal quantities, reordering and duplicating lines, product and customer suggestions from past quotes, discount (amount or percentage), untaxed other fees, validity and payment-term presets, draft autosave with restore, unsaved-changes guard, Ctrl/⌘+S, server validation errors shown on the fields.
- **Quote page**: status changes (draft, sent, accepted, rejected; expired is derived from the validity date), activity timeline, duplicate, print, share (with the PDF where the device supports it), send dialog with editable recipient, CC and message.
- **Quotes list**: search, status filters with counts, sorting, CSV export (UTF-8 with BOM for Excel), mobile cards.
- **Configurable quote numbers** such as `QT-{YYYY}{MM}{DD}-{SEQ:3}` or with the ROC year `{ROC}`, race-safe under concurrent saves.
- **Amount in words** for TWD (新台幣壹萬貳仟參佰元整).
- **PDF** in English or Chinese via `/api/quotes/<id>/pdf?lang=`, with bold headings, CJK line breaking and a small cache.
- **Health check** at `/api/health`, used by Docker, Compose and the homelab deploy.
- **Database migrations run automatically on start**, serialised with a PostgreSQL advisory lock; `SKIP_DB_MIGRATIONS=true` turns this off.
- **Multi-arch Docker image** (linux/amd64, linux/arm64) with OCI labels, provenance and SBOM; version tags `1.0.0`, `1.0`, `1` and `latest`.
- **CI**: migration check, lint, typecheck, unit and integration tests against PostgreSQL, standalone boot test, Playwright smoke tests on desktop and 375 px mobile, release job with the deploy bundle and `SHA256SUMS`; Dependabot.
- **Documentation**: rewritten READMEs (English and Traditional Chinese), guides for HTTPS and installing the app, backup and restore, Synology and QNAP, and Docker Desktop; `THIRD_PARTY_NOTICES.md`.

### Changed

- **Money columns are `bigint` cents** (they were `integer`, which capped totals at about 21 million) and quantities are `numeric(12,3)` so they can be fractional; totals are computed with integer arithmetic. `drizzle/0001` widens existing columns in place.
- The interface was redesigned for phones and desktops: top navigation with a bottom tab bar on phones, light and dark themes, skeleton loading states, empty states and accessible forms.
- Payment method, shipping method and shipping date are labelled **Payment terms**, **Delivery method** and **Delivery date** (付款條件、交貨方式、交貨日期).
- The PDF moved from `/<locale>/quotes/<id>/pdf` to `/api/quotes/<id>/pdf`.
- The Docker image runs as the built-in `node` user (uid 1000) with read-only application files, and is about 20% smaller: 77 MB to download for amd64 (no sharp/libvips, no TypeScript at runtime).
- The `latest` image tag now means the newest release, not the head of `main` (use `main` or `sha-<commit>` for development builds).
- The development `docker-compose.yaml` binds PostgreSQL to 127.0.0.1 only and waits for health checks.
- Branding images can be uploaded in Settings; files in `branding/` still work as a fallback.

### Removed

- `npm run db:push` and the deploy job's `drizzle-kit push` step: the app applies committed migrations itself, and pushing the schema first would make the next migration fail. Use `npm run db:generate` after changing `db/schema.ts`.

### Security

- `.dockerignore` keeps `.env` and other local files out of the image (a standalone build used to copy `.env` into it).
- Security headers (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and `frame-ancestors`, `Permissions-Policy`), no `X-Powered-By`.
- Rate limits on email sending, VAT lookups and sign-in; uploads are checked by content (PNG/JPEG magic bytes) and size.
- Unknown dotted paths and malformed quote IDs return 404 before any page renders.

### Upgrading from 0.x

1. Back up the database first (`pg_dump`, see [docs/deploy/backup.md](docs/deploy/backup.md)).
2. Start the new version: migrations upgrade databases created by `drizzle-kit push` in place and keep existing quotes.
3. If you used the old root `docker-compose.yaml`, your data volume is kept. The deploy bundle requires `POSTGRES_PASSWORD`: set it to the password your database already uses (`postgres` with the old compose file), or change it as described in the backup guide.
4. If you mount `branding/`, make sure the files are readable by uid 1000 (the image no longer runs as uid 1001).
5. Links to the old PDF URL need to point to `/api/quotes/<id>/pdf`.

[Unreleased]: https://github.com/sychen6192/quote-system/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/sychen6192/quote-system/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/sychen6192/quote-system/releases/tag/v1.0.0
