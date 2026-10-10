# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-09

The first release meant for other businesses to install. It adds an installable app, in-app settings, optional sign-in and one-command installation, and reworks most of the interface.

### Added

- **Install in one command.** `install.sh` downloads the release bundle, verifies its checksum, creates `.env` with random database password, session secret and sign-in password, and starts everything. Running it again upgrades.
- **Deploy bundle** (`deploy/`): Docker Compose file using the prebuilt image, PostgreSQL with health checks and no published port, an optional `https` profile (Caddy, automatic certificates or its own CA) and an optional `backup` profile (daily `pg_dump` with retention).
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

[Unreleased]: https://github.com/sychen6192/quote-system/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sychen6192/quote-system/releases/tag/v1.0.0
