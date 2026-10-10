# Backup, restore and moving servers

[繁體中文](backup.zh-TW.md)

All commands run in your install directory (`~/quote-system` by default).

## What to back up

| What | Where | Why |
|---|---|---|
| Database | Docker volume `quote-system_postgres_data` | Quotes, customers, settings and uploaded logo, stamp and icon |
| `.env` | install directory | Passwords and secrets. The database volume only accepts the `POSTGRES_PASSWORD` it was created with |
| `branding/` | install directory | Only if you still use image files instead of uploads |
| Caddy data | Docker volume `quote-system_caddy_data` | Only with the https profile and Caddy's local CA: losing it means trusting a new certificate on every device |

A database dump (below) is the reliable way to back up the database. Do not copy the volume's files while PostgreSQL is running.

## Automatic daily backups

```sh
docker compose --profile backup up -d
```

or put `COMPOSE_PROFILES=backup` (or `https,backup`) in `.env` and run `docker compose up -d`.

The `backup` service writes `backups/quote-YYYYMMDD-HHMMSS.dump` (PostgreSQL custom format, compressed) right away and then every `BACKUP_INTERVAL_SECONDS` (default 86400, one day), and deletes dumps older than `BACKUP_KEEP_DAYS` (default 14). `docker compose logs backup` shows each run.

A backup on the same disk does not survive that disk. Copy `backups/` and `.env` somewhere else regularly, for example with `rsync`, `rclone`, Synology Hyper Backup or QNAP Hybrid Backup Sync.

Each dump contains all your customers, quotes and settings, including the company stamp. Like `.env`, they are readable only by the owner of the `backups` folder (the user who ran the installer, mode 700 for the folder and 600 for the dumps). If you created the folder by hand, restrict it the same way: `chmod 700 backups`.

Check that a dump is readable:

```sh
docker compose exec -T db pg_restore --list < backups/quote-20261009-030000.dump | head
```

## Manual backup

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > quote-$(date +%F).dump
```

## Restore

This deletes the database and replaces it with the dump's contents. Stop the app (and the backup service, if you use it), recreate an empty database, restore into it, then start the app again:

```sh
docker compose stop app backup
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < quote-2026-10-09.dump
docker compose start app
```

`pg_restore` must finish without an error message. If it stops with one, fix the cause (usually a wrong file name, or a dump that is not a `pg_dump -Fc` file) and run the commands again from `dropdb`; do not start the app on a half-restored database. If you use the backup profile, start it again with `docker compose start backup`.

Restoring into an empty database is what makes this safe across versions: a dump from an older version is fine, and the app applies any newer migrations when it starts. Restoring a dump from a *newer* version into an older app is not supported.

## Move to a new server

1. On the old server, take a manual backup (above) and stop the app: `docker compose stop app`.
2. On the new server, install as usual (`sh install.sh`). A fresh `.env` is fine; dumps contain no passwords. Copy over `APP_PASSWORD` and `RESEND_API_KEY` from the old `.env` if you want to keep them.
3. Copy the dump across and restore it on the new server with the commands under [Restore](#restore). It is fine if the new server runs a newer version than the old one.
4. If you use Caddy's local CA, either copy the `caddy_data` volume too or trust the new server's certificate on every device.

## Change the database password

The `POSTGRES_PASSWORD` in `.env` is only applied when the database is first created. To change it later:

```sh
docker compose exec db psql -U postgres -d quote-system -c "ALTER USER postgres PASSWORD 'NewPassword123'"
```

(Use your `POSTGRES_USER` and `POSTGRES_DB` if you changed them.) Then set `POSTGRES_PASSWORD=NewPassword123` in `.env` (letters and digits only) and run `docker compose up -d`.

If `.env` was lost, use the same command to set a known password; inside the container `psql` does not need the old one.

## Upgrade PostgreSQL to a new major version

The bundle pins `postgres:16-alpine`, and a PostgreSQL major version cannot open another major's data files. To move to, say, PostgreSQL 17:

1. Take a manual backup and keep a second copy.
2. Stop everything and remove the old data volume:

   ```sh
   docker compose down
   docker volume rm quote-system_postgres_data
   ```

3. Override the image in `docker-compose.override.yml` (this file survives upgrades of the bundle):

   ```yaml
   services:
     db:
       image: postgres:17-alpine
     backup:
       image: postgres:17-alpine
   ```

4. Start the database alone, restore, then start the rest:

   ```sh
   docker compose up -d db
   docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < quote-2026-10-09.dump
   docker compose up -d
   ```

PostgreSQL 18 images keep their data under `/var/lib/postgresql` instead of `/var/lib/postgresql/data`; adjust the volume path in the override as well if you go to 18.
