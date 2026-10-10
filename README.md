# Quote System

**Self-hosted quotations for small businesses.** Write a quote on your phone or computer, send a print-ready PDF in English or Traditional Chinese, and see what is still open, won or about to expire. Your data stays in your own database; install it with one command and set it up from the Settings page.

[繁體中文說明 → README.zh-TW.md](README.zh-TW.md)

<p align="center">
  <img src="docs/images/dashboard.png" alt="Dashboard with open pipeline, acceptance rate, quotes expiring soon and recent quotes" width="860">
</p>

## Features

- **Quotes that look professional.** Live A4 preview while you type (click any part to edit it), line items with descriptions, units and decimal quantities, taxable and tax-exempt lines, discount as amount or percentage, other fees, amount in words (新台幣壹萬貳仟元整).
- **PDF in two languages.** Server-rendered A4 PDF with embedded Noto Sans TC, so Chinese prints correctly everywhere. Download, print, or share it from your phone.
- **Email it.** Send the quote with its PDF attached through [Resend](https://resend.com), with editable recipient, CC and message.
- **Know where you stand.** Dashboard with open pipeline, accepted this month, acceptance rate and drafts; quotes expiring in the next 7 days; status lifecycle (draft, sent, accepted, rejected, expired) with an activity log.
- **Fast entry.** Customer and product suggestions from past quotes, duplicate a quote, payment-term and validity presets, draft autosave with restore, Ctrl/⌘+S to save. Optional Taiwan 統一編號 lookup.
- **Customer directory** with quote counts, accepted totals and one-tap "new quote for this customer".
- **Set up in the app.** Company details, logo, company stamp, app icon, brand colour, quote numbering (`QT-{YYYY}{MM}{DD}-{SEQ:3}`, ROC years supported), default tax, terms, bank details, email sender, currency and time zone, all on the Settings page.
- **Installable app (PWA).** Add it to your phone's home screen or your computer's dock; it opens in its own window and shows a friendly offline page when the network is gone.
- **Built for phones and desktops.** Bottom tab bar and sticky action bars on phones, keyboard shortcuts on desktop, light and dark themes, English and Traditional Chinese.
- **Safe to run yourself.** Optional password sign-in, automatic database migrations, CSV export, scheduled backups, a multi-arch Docker image (amd64 and arm64) that runs as a non-root user.

<p align="center">
  <img src="docs/images/quote-editor.png" alt="Quote editor with a live A4 preview next to the form" width="860">
</p>

<p align="center">
  <img src="docs/images/mobile.png" alt="On a phone: the dashboard, the quote list in the dark theme, and a quote with its PDF preview" width="860">
</p>

## Install in 5 minutes

You need a computer, server or NAS with [Docker](https://docs.docker.com/engine/install/) and Docker Compose v2.17 or newer (Docker Desktop on Windows and macOS includes both). Linux on amd64 or arm64 (for example a Raspberry Pi 4/5 with a 64-bit OS) works.

### With the installer

```sh
curl -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/install.sh
less install.sh    # optional: read what it does
sh install.sh
```

The installer:

1. checks Docker and Compose,
2. downloads the release bundle (`docker-compose.yml`, `Caddyfile`, `.env.example`) into `~/quote-system` and verifies its SHA-256 checksum,
3. creates `.env` with a random database password, session secret and **sign-in password** (printed once at the end; it is also in `.env`),
4. starts the app and the database and waits until they are healthy.

Open the address it prints (for example `http://192.168.1.20:3000`) and sign in.

Options are environment variables, for example `QUOTE_DIR=/opt/quote-system QUOTE_VERSION=1.0.0 APP_PORT=8080 sh install.sh`. `APP_PASSWORD=` (empty) turns sign-in off. Running the installer again upgrades to the latest release and keeps your `.env` and data.

### By hand with Docker Compose

```sh
mkdir quote-system && cd quote-system
curl -fsSL https://github.com/sychen6192/quote-system/releases/latest/download/quote-system-deploy.tar.gz | tar -xz
cp .env.example .env
```

Edit `.env` and set at least these three values (`openssl rand -hex 24` prints a good random value):

```ini
POSTGRES_PASSWORD=<letters and digits only>
AUTH_SECRET=<at least 32 random characters>
APP_PASSWORD=<the password everyone signs in with>
```

Then start it:

```sh
docker compose up -d
```

The app is on port 3000 (`APP_PORT`). The database is not published on any port. On Windows, the same commands work in PowerShell (Windows 10 and later include `curl` and `tar`); see [Docker Desktop on Windows and macOS](docs/deploy/docker-desktop.md). For Synology and QNAP see [NAS notes](docs/deploy/nas.md).

## First-run setup

Open **Settings** (the dashboard shows a checklist until this is done):

| Tab | What to fill in |
|---|---|
| Company | Name (and a local-language name), address, 統一編號 / VAT number, email, phone, website |
| Branding | Logo and company stamp (PNG or JPEG, up to 1 MB), app icon, brand colour |
| Quotes | Number pattern, validity days, default tax rate, default notes and terms, salesperson, amount in words, PDF footer |
| Payment | Bank name, bank code, account name and number (printed on quotes) |
| Email | Sender name and address, CC, reply-to (the Resend API key itself stays in `.env`) |
| Regional | Currency, money format, time zone, Taiwan 統編 lookup |
| About | Version, sign-in status, install the app, CSV export, backup notes |

Everything saved here is stored in the database, takes precedence over `.env`, and is included in database backups.

## HTTPS and installing on phones

Browsers only install web apps from a secure address: `https://…`, or `http://localhost` on the same computer. Plain `http://192.168.1.20:3000` works for everything else, but the install option will not appear on phones. Pick one of these:

1. **Caddy with its own certificate authority (home or office network).** In `.env` set `SITE_ADDRESS` to the server's IP or a name such as `quote.local`, and `APP_BIND=127.0.0.1`. Then run `docker compose --profile https up -d` and open `https://<SITE_ADDRESS>`. Each device must trust Caddy's root certificate once (iPhone, iPad, Android, Windows and macOS steps are in the [HTTPS guide](docs/deploy/https.md)).
2. **A real domain.** Point a DNS record such as `quote.example.com` at the server, make ports 80 and 443 reachable from the internet, set `SITE_ADDRESS=quote.example.com` and run `docker compose --profile https up -d`. Caddy gets and renews a free certificate. Keep `APP_PASSWORD` set.
3. **Tailscale or Cloudflare Tunnel (no open ports).** `tailscale serve --bg 3000` gives you `https://<machine>.<tailnet>.ts.net` with a valid certificate on every device in your tailnet; a Cloudflare Tunnel publishes the app on your domain, and Cloudflare Access can add a login in front of it.

Then install it:

- **iPhone and iPad:** open the address in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** in Chrome, tap the menu, then **Install app** (or use the app's own **Install** button).
- **Windows, macOS, Linux:** in Chrome or Edge, click the install icon in the address bar or the app's **Install** button.

Put `COMPOSE_PROFILES=https` in `.env` to make the plain `docker compose up -d` include Caddy.

## Configuration

Set values on the Settings page where you can; environment variables in `.env` pre-fill the same fields and cover what only the server should know. Precedence, field by field: **Settings page > `.env` > built-in default**. Restart after editing `.env`: `docker compose up -d`.

### Server and security

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | set by `docker-compose.yml` | PostgreSQL connection string (required when running without the bundle) |
| `POSTGRES_PASSWORD` | none, required | Database password for the bundled PostgreSQL (letters and digits). Only used when the database is first created |
| `APP_PASSWORD` | empty (sign-in off) | Shared sign-in password. Changing it signs everyone out |
| `AUTH_SECRET` | derived from `APP_PASSWORD`, with a warning | Random string of at least 32 characters that signs session cookies |
| `APP_NAME` | company name, then "Quote System" | Name of the installed app |
| `APP_TIMEZONE` | `TZ`, then `Asia/Taipei` | IANA time zone that decides "today" for dates, numbering and expiry |
| `RESEND_API_KEY` | empty (email off) | [Resend](https://resend.com) API key. Only read from the environment |
| `DB_POOL_MAX` | `10` | Database connections per app instance (1-100) |
| `SKIP_DB_MIGRATIONS` | `false` | `true` skips the automatic migrations on start (run `npm run db:migrate` yourself) |
| `PWA_DISABLE_SW` | `false` | Emergency switch: `true` makes the service worker clear its caches and uninstall itself on every device |

### Defaults for the Settings page

| Variable | Default | Settings field |
|---|---|---|
| `COMPANY_NAME` | `Your Company` | Company name |
| `COMPANY_NAME_LOCAL` | hidden | Local-language name, shown under the main name |
| `COMPANY_ADDRESS`, `COMPANY_EMAIL`, `COMPANY_PHONE` | hidden | Contact details |
| `COMPANY_VAT_NUMBER` | hidden | 統一編號 / VAT number |
| `COMPANY_WEBSITE` | hidden | Website (`example.com` or a full `https://` URL) |
| `BANK_NAME`, `BANK_CODE`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER` | hidden | Payment details block (hidden while all are empty) |
| `QUOTE_NUMBER_PATTERN` | `QT-{YYYY}{MM}{DD}-{SEQ:3}` | Number pattern. Tokens `{YYYY}` `{YY}` `{ROC}` (民國年) `{MM}` `{DD}` and one `{SEQ}` or `{SEQ:n}` |
| `QUOTE_VALIDITY_DAYS` | `30` | Days a new quote stays valid (1-365) |
| `DEFAULT_TAX_RATE` | `5` | Tax rate (%) for new quotes (0-100) |
| `DEFAULT_NOTES`, `DEFAULT_TERMS` | empty | Notes and terms for new quotes (`\n` for line breaks) |
| `CURRENCY` | `TWD` | ISO 4217 currency code |
| `CURRENCY_LOCALE` | `zh-TW` | Locale for formatting money, independent of the UI language |
| `BRAND_COLOR` | `#1D4ED8` | Brand colour (`#RRGGBB`) for buttons, PDF accent and the installed app |
| `MAIL_SENDER_NAME` | company name | Email sender name |
| `MAIL_SENDER_EMAIL` | `onboarding@resend.dev` (testing only) | Sender address on a domain verified in Resend |
| `MAIL_CC_EMAILS` | none | Comma-separated CC addresses |
| `MAIL_REPLY_TO` | sender | Reply-to address |
| `TW_VAT_LOOKUP` | `false` | `true` shows the 統編 lookup button (public GCIS open data) |

### Docker bundle (`deploy/docker-compose.yml`)

| Variable | Default | Purpose |
|---|---|---|
| `QUOTE_VERSION` | the release you installed | Image tag: `1.0.0`, `1.0`, `1` or `latest` |
| `QUOTE_IMAGE` | `ghcr.io/sychen6192/quote-system` | Image repository (for mirrors or your own builds) |
| `APP_PORT` / `APP_BIND` | `3000` / `0.0.0.0` | Host port and address of the app. Use `APP_BIND=127.0.0.1` behind Caddy |
| `SITE_ADDRESS` | `localhost` | Domain, IP or local name Caddy serves (https profile) |
| `CADDY_TLS` | empty | `tls internal` forces Caddy's own CA for private names such as `quote.office` |
| `HTTP_PORT` / `HTTPS_PORT` | `80` / `443` | Host ports for Caddy |
| `COMPOSE_PROFILES` | empty | Optional services to start with plain commands: `https`, `backup` or `https,backup` |
| `BACKUP_KEEP_DAYS` | `14` | Days of backups to keep (backup profile) |
| `BACKUP_INTERVAL_SECONDS` | `86400` | Time between backups (backup profile) |
| `POSTGRES_USER` / `POSTGRES_DB` | `postgres` / `quote-system` | Database user and name |

Write `KEY=value` without quotes. Branding images can still be mounted the old way, as `branding/logo.png`, `branding/stamp.png` and `branding/icon.png` next to `docker-compose.yml`; uploads on the Settings page take precedence.

## Password protection

Sign-in is on when `APP_PASSWORD` is set (the installer sets a random one). Everyone shares that password; a session lasts 30 days.

- Change the password in `.env` and run `docker compose up -d`: everyone is signed out.
- After 5 wrong passwords from one address, sign-in pauses for 15 minutes.
- Session cookies are `HttpOnly` and `SameSite=Lax`, and `Secure` when the request came over HTTPS (Caddy tells the app).
- `/api/health` and the app's icons and manifest stay public so health checks and installs work.

Without a password, anyone who can reach the port can read and change your quotes. Never expose an instance without `APP_PASSWORD` to the internet, and prefer HTTPS when you do. Docker publishes ports past host firewalls such as ufw, so use `APP_BIND=127.0.0.1` when only Caddy should be reachable.

## Backup and restore

The database holds everything: quotes, customers, settings and uploaded images. Back it up together with `.env` (the database only accepts the password it was created with).

**Automatic backups.** `docker compose --profile backup up -d` writes a compressed dump to `./backups` every day (`BACKUP_INTERVAL_SECONDS`) and deletes dumps older than 14 days (`BACKUP_KEEP_DAYS`). Copy that folder somewhere else, too.

**Manual backup:**

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > quote-$(date +%F).dump
```

**Restore** (replaces the current data):

```sh
docker compose stop app
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < quote-2026-10-09.dump
docker compose start app
```

Moving to a new server, rotating the database password and upgrading PostgreSQL are covered in the [backup guide](docs/deploy/backup.md).

## Upgrading

```sh
cd ~/quote-system
docker compose pull
docker compose up -d
```

Database migrations run automatically when the new version starts. With `QUOTE_VERSION` pinned (the installer pins the release you installed), change it first, or simply run the installer again: it moves `QUOTE_VERSION` to the newest release, keeps `.env` and your data, and saves a copy of any `docker-compose.yml` you changed (keep local changes in `docker-compose.override.yml`).

Take a backup before upgrading. Migrations only go forward: to roll back across one, restore the backup taken before the upgrade and set `QUOTE_VERSION` back. Release notes are on the [releases page](https://github.com/sychen6192/quote-system/releases) and in [CHANGELOG.md](CHANGELOG.md).

## Development

Requirements: Node.js 22+ and Docker (for PostgreSQL).

```sh
git clone https://github.com/sychen6192/quote-system.git
cd quote-system
npm ci
cp .env.example .env              # DATABASE_URL points at the compose database
docker compose up -d postgres     # PostgreSQL 16 on 127.0.0.1:5432
npm run dev                       # http://localhost:3000; migrations run on start
```

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint and ICU message syntax check |
| `npm run typecheck` | TypeScript |
| `npm test` | Jest unit tests (integration tests run when `TEST_DATABASE_URL` is set) |
| `npm run test:e2e` | Playwright smoke tests: builds, starts the production server on port 3100 and tests desktop and 375 px mobile (needs `DATABASE_URL`) |
| `npm run db:generate` | Create a migration after changing `db/schema.ts` (commit the `drizzle/` output) |
| `npm run db:migrate` | Apply migrations without starting the app |
| `npm run db:studio` | Browse the database |
| `docker compose up -d --build` | Build the image from source and run it with PostgreSQL |

Integration tests truncate tables, so give them their own database:

```sh
docker compose exec postgres createdb -U postgres quote_test
DATABASE_URL=postgres://postgres:postgres@localhost:5432/quote_test npm run db:migrate
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/quote_test npm test
```

Run the end-to-end tests against a server that is already running with `E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e` (add `E2E_APP_PASSWORD` when it has a password). Install Chromium once with `npx playwright install chromium`.

The service worker only registers in production builds; set `NEXT_PUBLIC_ENABLE_SW=1` to try it under `npm run dev`.

Translations live in `messages/<locale>/<Namespace>.json`; new namespaces are registered in `i18n/messages.ts`, and a unit test keeps the English and Chinese keys in sync.

### Continuous integration

`.github/workflows/pipeline.yml` runs on every push and pull request:

- **ci**: checks that schema changes come with a migration, lint, typecheck, unit and integration tests against PostgreSQL, production build, then boots the standalone server twice against an empty database (migrations apply, then are a no-op).
- **e2e**: the Playwright smoke tests against the production build with sign-in on, desktop and 375 px mobile (report uploaded on failure).
- **image**: multi-arch image (linux/amd64 and linux/arm64) with OCI labels, provenance and SBOM. Pushed to `ghcr.io/sychen6192/quote-system` only from `main` (`main`, `sha-<commit>`) and version tags (`1.2.3`, `1.2`, `1`, `latest`).
- **release** (tags `v*.*.*`): GitHub release with the deploy bundle, `install.sh` and `SHA256SUMS`.

## Architecture

```mermaid
flowchart TB
  Browser["Browser or installed app<br/>(service worker, offline page)"]
  Caddy["Caddy, optional<br/>(HTTPS certificates)"]
  Browser -->|HTTPS| Caddy
  subgraph App["Next.js app in Docker"]
    Proxy["proxy.ts<br/>sign-in and locale routing"]
    Pages["Pages and Server Actions"]
    Routes["Route handlers<br/>PDF, CSV, branding, PWA, health"]
    Services["services/ and lib/<br/>queries, money, numbering, settings"]
    Proxy --> Pages & Routes
    Pages & Routes --> Services
  end
  Caddy --> Proxy
  Browser -->|"HTTP (LAN)"| Proxy
  Resend["Resend API<br/>(email)"]
  DB[("PostgreSQL 16<br/>quotes, settings, images")]
  PDF["A4 PDF<br/>(react-pdf, Noto Sans TC)"]
  Pages -.-> Resend
  Services -->|Drizzle ORM| DB
  Routes -.-> PDF
```

- **Next.js 16 App Router** with React Server Components and Server Actions; every action and private route re-checks the session.
- **PostgreSQL + Drizzle ORM.** Money is stored as integer cents, quantities as `numeric(12,3)`. Migrations in `drizzle/` are applied on start under an advisory lock (`instrumentation.ts`, `lib/db/migrate.ts`), so several replicas can start together.
- **Settings** are layered per field: database (Settings page) over environment over defaults (`lib/settings/`).
- **One document model** (`lib/quote-view.ts`) feeds the HTML preview, the quote page and the PDF, so they cannot drift apart.
- **PWA**: dynamic manifest and icons from your branding, a hand-written service worker that caches static assets only (never quotes, PDFs or API responses) and a bilingual offline page.
- **Docker**: standalone output, built on the build machine's architecture and copied into `node:22-alpine` for amd64 and arm64; runs as `node`, health check on `/api/health`.

```
actions/       Server Actions (quotes, status, email, settings)
app/           Pages, route handlers, PWA routes
components/    UI (shadcn/ui primitives in components/ui)
db/            Drizzle schema and client
deploy/        Self-hosting bundle (compose, Caddyfile, installer)
docs/          Guides (docs/deploy) and design notes
drizzle/       SQL migrations
lib/           Money, numbering, dates, settings, auth, PDF
messages/      Translations (en, zh-TW)
services/      Read-side queries
tests/         Jest unit tests (tests/unit) and Playwright smoke tests (tests/e2e)
```

## Roadmap

- Public share links where customers can view and accept a quote
- Convert an accepted quote into an invoice
- A different currency per quote
- Multiple users with roles
- SMTP as an alternative to Resend
- Creating and editing quotes while offline
- More languages

Ideas and pull requests are welcome: open an issue first for larger changes, and make sure `npm run lint`, `npm run typecheck` and `npm test` pass.

## Credits

- [Invoify](https://github.com/al1abb/invoify) by Ali Abbasov (MIT): the live preview with fit-to-width scaling, draft autosave, item reordering, payment-term presets, the form's section index, the PDF cache, rate limiting and the Playwright smoke-test helpers are adapted from it. Files carry a header comment; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Feature ideas from Invoice Ninja, Crater and InvoicePlane (no code taken).
- [shadcn/ui](https://ui.shadcn.com), [Radix UI](https://www.radix-ui.com), [Lucide](https://lucide.dev) icons, [Noto Sans TC](https://fonts.google.com/noto/specimen/Noto+Sans+TC) and [Inter](https://rsms.me/inter/) fonts.

## License

[MIT](LICENSE) © 2026 Jack SY Chen. Third-party components and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
