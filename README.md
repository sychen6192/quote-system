# Quote System

A self-hosted quotation management system for small businesses — create quotes, generate PDF documents, and email them to customers. Fully **white-label**: company identity, branding images, currency, and tax defaults are injected at runtime, so any company can deploy the same build with its own configuration.

[繁體中文說明 → README.zh-TW.md](README.zh-TW.md)

## Features

- **Quotation management** — create, edit, and list quotes with dynamic line items and real-time subtotal / tax / total calculation
- **Financial accuracy** — amounts stored as integer cents, tax rates as basis points; no floating-point drift
- **PDF export** — print-ready A4 quotation PDF (CJK fonts included) rendered on the server
- **Email delivery** — send the quote (with PDF attachment) to customers via [Resend](https://resend.com)
- **White-label branding** — company info via environment variables, logo / stamp / favicon via image files, all with safe placeholder fallbacks
- **i18n** — English and Traditional Chinese out of the box (next-intl)
- **Type-safe stack** — Next.js App Router + Server Actions, TypeScript strict mode, Drizzle ORM, Zod validation shared between client and server

## Tech Stack

Next.js 16 (App Router) · TypeScript · PostgreSQL · Drizzle ORM · shadcn/ui + Tailwind CSS · React Hook Form + Zod · @react-pdf/renderer · react-email + Resend · Jest

## Quickstart

Prerequisites: Node.js 22+, Docker (for PostgreSQL).

```bash
git clone https://github.com/sychen6192/quote-system.git
cd quote-system
npm install

# 1. Start the database
docker compose up -d postgres

# 2. Minimal env (see .env.example for everything else)
echo 'DATABASE_URL="postgres://postgres:postgres@localhost:5432/quote-system"' > .env

# 3. Create the tables
npm run db:push

# 4. Run
npm run dev
```

That's it — the app runs with placeholder branding ("Your Company" + a neutral logo). Configure your own identity below.

## Configuration

All configuration is **read at runtime**. Nothing is baked into the build, so one Docker image works for every company.

### Environment variables

Copy `.env.example` to `.env` and fill in your values. Every variable except `DATABASE_URL` is optional.

| Variable | Default when unset | Purpose |
|---|---|---|
| `DATABASE_URL` | — (required) | PostgreSQL connection string |
| `COMPANY_NAME` | `Your Company` | Main company name (page, PDF, email, browser title) |
| `COMPANY_NAME_LOCAL` | hidden | Local-language name shown under the main name |
| `COMPANY_ADDRESS` | hidden | Address |
| `COMPANY_VAT_NUMBER` | hidden | VAT / tax registration number |
| `COMPANY_EMAIL` | hidden | Contact email |
| `COMPANY_PHONE` | hidden | Contact phone |
| `BANK_NAME` / `BANK_ACCOUNT_NAME` / `BANK_ACCOUNT_NUMBER` | section hidden | Payment details block (hidden when all three are empty) |
| `RESEND_API_KEY` | email disabled | Resend API key; without it the Send Email button is disabled |
| `MAIL_SENDER_NAME` | `COMPANY_NAME` | Email sender display name |
| `MAIL_SENDER_EMAIL` | `onboarding@resend.dev` | Sender address (must be verified in Resend) |
| `MAIL_CC_EMAILS` | none | Comma-separated CC list |
| `CURRENCY` | `TWD` | ISO 4217 currency code |
| `CURRENCY_LOCALE` | `zh-TW` | Intl locale for money formatting |
| `DEFAULT_TAX_RATE` | `5` | Default tax rate (%) for new quotes |

### Branding images

Drop PNG files into a `branding/` directory at the project root (gitignored — your assets never end up in the repo):

| File | Fallback | Used for |
|---|---|---|
| `branding/logo.png` | neutral default logo | Quote page, PDF, email header |
| `branding/stamp.png` | section omitted | Company stamp on the PDF signature area |
| `branding/icon.png` | `logo.png` → default logo | Browser favicon (served at `/api/branding-icon`) |

## Deployment (Docker)

`docker compose up -d` builds and runs the full stack (app + PostgreSQL). Your `.env` and `branding/` are injected at runtime:

```yaml
# already wired in docker-compose.yaml
env_file: [.env]
volumes:
  - ./branding:/app/branding
```

Or run a prebuilt image directly:

```bash
docker run -d --name quote-system -p 3000:3000 \
  --env-file /path/to/.env \
  -v /path/to/branding:/app/branding \
  ghcr.io/sychen6192/quote-system:latest
```

Run `npm run db:push` against your database once to create the tables.

> `.github/workflows/pipeline.yml` runs lint/test/build on every push and PR. On the author's repo it additionally builds a Docker image (tagged `latest` and `sha-<commit>`) **only after CI passes**, then deploys it to a homelab self-hosted runner with a post-deploy health check — both steps are guarded by a `repository_owner` condition and will not run on forks.
>
> **Rollback:** every deploy is pinned to its commit — rerun the container with a previous tag: `docker run ... ghcr.io/<owner>/quote-system:sha-<previous-commit>` (tags are listed under GitHub Packages).

## Security

**This application has no authentication.** It is designed for internal use on a trusted network (e.g. an office LAN or a private homelab). If you expose it to the internet, put an authenticating reverse proxy in front of it (Cloudflare Access, Authelia, oauth2-proxy, …). Contributions adding built-in auth are welcome — see Roadmap.

## Project Structure

```
quote-system/
├── actions/            # Server Actions (create/update quote, send email)
├── app/                # Next.js App Router pages + API routes
├── branding-defaults/  # Committed fallback branding assets
├── components/         # React components (ui/, quotes/, pdf/, emails/, providers/)
├── db/                 # Drizzle schema + client
├── lib/                # config loader, zod schemas, money utils
├── messages/           # i18n messages (en, zh-TW)
├── services/           # Read-side query services
└── tests/              # Jest unit tests
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Run Jest test suite |
| `npm run lint` | ESLint |
| `npm run db:push` | Push Drizzle schema to the database |
| `npm run db:studio` | Drizzle Studio (DB browser) |

## Roadmap

Ideas we would happily accept PRs for:

- Built-in authentication / user management
- Settings UI (edit company info in the app instead of env vars)
- Multi-currency quotes
- Additional languages

## Contributing

1. Fork and create a feature branch
2. `npm test && npm run lint` must pass; CI also runs a full build
3. Open a pull request

## License

[MIT](LICENSE) © 2026 Jack SY Chen
