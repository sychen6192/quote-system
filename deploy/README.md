# Quote System deploy bundle

Everything needed to run a released version of [Quote System](https://github.com/sychen6192/quote-system) with Docker Compose. Nothing is built here; the app image is pulled from `ghcr.io/sychen6192/quote-system`.

| File | Purpose |
|---|---|
| `install.sh` | Installer and upgrader: downloads this bundle, verifies it, creates `.env` with random secrets, starts everything |
| `docker-compose.yml` | App, PostgreSQL 16, and the optional `https` (Caddy) and `backup` (daily `pg_dump`) profiles |
| `Caddyfile` | HTTPS reverse proxy for the `https` profile |
| `.env.example` | Settings template; copy to `.env` |

Quick start without the installer:

```sh
cp .env.example .env      # set POSTGRES_PASSWORD, AUTH_SECRET and APP_PASSWORD
docker compose up -d      # http://<server-ip>:3000
```

`APP_PASSWORD` may contain letters, digits and `. _ ~ ! @ % ^ * + = : , -`; for other characters, wrap it in single quotes (`APP_PASSWORD='Acme$ecure #2026'`). Unquoted, Docker Compose would change a password with `$` or ` #` in it.

Useful commands:

```sh
docker compose --profile https up -d     # HTTPS via Caddy (SITE_ADDRESS and APP_BIND=127.0.0.1 in .env)
docker compose --profile backup up -d    # daily database dumps into ./backups
# upgrade: set QUOTE_VERSION in .env to the new release (or re-run install.sh), then
docker compose pull && docker compose up -d    # migrations run on start
docker compose logs -f app               # app logs
```

Keep local changes in `docker-compose.override.yml`; the installer replaces `docker-compose.yml` and `Caddyfile` when it upgrades (it keeps a `.bak` copy of files you edited).

Guides: [README](https://github.com/sychen6192/quote-system#readme) · [HTTPS and installing the app](https://github.com/sychen6192/quote-system/blob/main/docs/deploy/https.md) · [Backup and restore](https://github.com/sychen6192/quote-system/blob/main/docs/deploy/backup.md) · [Synology and QNAP](https://github.com/sychen6192/quote-system/blob/main/docs/deploy/nas.md) · [Docker Desktop](https://github.com/sychen6192/quote-system/blob/main/docs/deploy/docker-desktop.md)
