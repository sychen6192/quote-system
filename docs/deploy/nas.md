# Synology and QNAP NAS

[繁體中文](nas.zh-TW.md)

A NAS that is always on is a good home for Quote System. The image runs on **x86-64 (amd64)** and **64-bit ARM (arm64)** models; 32-bit ARM models cannot run it. Check your model's CPU on the vendor's website. Menu names below are from DSM 7.2 and QTS 5.1 and may differ slightly on other versions.

## Synology (DSM 7.2 or newer)

Install **Container Manager** from Package Center.

### Option A: the installer over SSH (recommended)

1. **Control Panel → Terminal & SNMP → Enable SSH service.**
2. From your computer:

   ```sh
   ssh <your-admin-user>@<nas-ip>
   curl -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/install.sh
   sudo QUOTE_DIR=/volume1/docker/quote-system sh install.sh
   ```

   Docker on DSM needs `sudo`. Note the sign-in password the installer prints.
3. Open `http://<nas-ip>:3000`. The project also appears in Container Manager under **Project**.

If `docker compose` is reported missing, use option B.

### Option B: Container Manager only

1. On your computer, download `quote-system-deploy.tar.gz` from the [latest release](https://github.com/sychen6192/quote-system/releases/latest) and extract it (7-Zip on Windows, double-click on macOS).
2. Copy `.env.example` to a file named `.env` and set `POSTGRES_PASSWORD` (letters and digits), `AUTH_SECRET` (32+ random characters) and `APP_PASSWORD`.
3. In File Station, create `docker/quote-system` and upload `docker-compose.yml`, `Caddyfile` and `.env` into it. Create empty `branding` and `backups` folders there too.
4. **Container Manager → Project → Create**: name `quote-system`, path `docker/quote-system`, choose **Use existing docker-compose.yml**, then **Next → Done**.

### HTTPS on Synology

DSM itself uses ports 80 and 443, so use DSM's reverse proxy instead of the bundle's Caddy:

1. Get a certificate: **Control Panel → External Access → DDNS** (for example `yourname.synology.me`), then **Control Panel → Security → Certificate → Add → Let's Encrypt**. Include a name for the app, such as `quote.yourname.synology.me`, if your DDNS provider supports subdomains, or use your own domain.
2. **Control Panel → Login Portal → Advanced → Reverse Proxy → Create:**
   - Source: protocol **HTTPS**, hostname `quote.yourname.synology.me`, port **443**
   - Destination: protocol **HTTP**, hostname `localhost`, port **3000**
   - Custom Header: add `X-Forwarded-Proto` with value `https`
3. **Control Panel → Security → Certificate → Settings**: assign the certificate to the new reverse proxy entry.
4. Open `https://quote.yourname.synology.me` and [install the app](https.md#installing-the-app).

Reaching it from outside your network also needs port 443 forwarded to the NAS. For access only from your own devices, the Tailscale package for DSM with `tailscale serve` works too ([HTTPS guide](https.md#tailscale-private-only-your-devices)).

### Backups on Synology

Start the backup service once (SSH: `cd /volume1/docker/quote-system && sudo docker compose --profile backup up -d`, or add `COMPOSE_PROFILES=backup` to `.env` and rebuild the project), then include `docker/quote-system` in a **Hyper Backup** task so the dumps and `.env` leave the NAS.

## QNAP (QTS 5.1 / QuTS hero with Container Station 3)

Install **Container Station** from App Center and enable SSH (**Control Panel → Network & File Services → Telnet / SSH**).

```sh
ssh admin@<nas-ip>
curl -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/install.sh
sudo QUOTE_DIR=/share/Container/quote-system sh install.sh
```

Open `http://<nas-ip>:3000`. The containers are listed in Container Station.

QTS uses ports 8080 and 443 for its own web interface. For HTTPS, either use **Control Panel → Network & File Services → Network Access → Reverse Proxy** (QTS 5.1+) pointing at `http://localhost:3000` with a myQNAPcloud or your own certificate, or run the bundle's Caddy on other ports (`HTTP_PORT=8081`, `HTTPS_PORT=8443` in `.env`) as described in the [HTTPS guide](https.md).

For backups, start the backup profile as above and include `/share/Container/quote-system` in a **Hybrid Backup Sync** job.

## Upgrading on a NAS

Over SSH, in the install directory:

```sh
sudo docker compose pull && sudo docker compose up -d
```

or run the installer again with the same `QUOTE_DIR`. Migrations run automatically.
