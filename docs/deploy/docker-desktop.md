# Docker Desktop on Windows and macOS

[繁體中文](docker-desktop.zh-TW.md)

Docker Desktop is the easiest way to try Quote System on a laptop, or to run it for a small office on an always-on PC or Mac mini. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/), start it, and wait until it says the engine is running.

## macOS

Open **Terminal** and run the installer, exactly as on Linux:

```sh
curl -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/install.sh
sh install.sh
```

It installs into `~/quote-system` and prints the sign-in password. Open `http://localhost:3000`.

## Windows

### PowerShell

```powershell
mkdir $HOME\quote-system
cd $HOME\quote-system
curl.exe -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/quote-system-deploy.tar.gz
tar -xzf quote-system-deploy.tar.gz
copy .env.example .env
notepad .env
```

Type `curl.exe`, not `curl`: in Windows PowerShell `curl` is a different command. In Notepad, set these three lines, then save:

```ini
POSTGRES_PASSWORD=<letters and digits only>
AUTH_SECRET=<at least 32 random characters>
APP_PASSWORD=<the password everyone signs in with>
```

Write the values without quotes. `APP_PASSWORD` may contain letters, digits and `. _ ~ ! @ % ^ * + = : , -`; for any other character, wrap the whole password in single quotes, for example `APP_PASSWORD='Acme$ecure #2026'`. Docker Compose would otherwise change a password that contains `$` or ` #`, and nobody could sign in with what you typed.

This PowerShell line prints a suitable random value each time you run it:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
```

Start it and open `http://localhost:3000`:

```powershell
docker compose up -d
```

### WSL (Ubuntu)

With Docker Desktop's WSL integration turned on (**Settings → Resources → WSL integration**), you can run `install.sh` in an Ubuntu terminal exactly as on Linux.

## Using it from other devices

Other computers and phones on the same network can open `http://<your-computer's-IP>:3000` (find the IP with `ipconfig` on Windows or **System Settings → Network** on macOS). Windows may ask whether Docker Desktop may accept connections on private networks: allow it.

To install the app on phones you need HTTPS. On a desktop computer the simplest option is [Tailscale](https.md#tailscale-private-only-your-devices); the other options are in the [HTTPS guide](https.md).

## Keeping it running

- **Docker Desktop → Settings → General → Start Docker Desktop when you sign in.** The containers restart by themselves when Docker starts.
- A laptop that sleeps takes the app offline for everyone else. For an office, use an always-on machine or a [NAS](nas.md).
- Back up the `backups` folder and `.env` (see the [backup guide](backup.md)).

## Upgrading

On macOS (and in WSL), run the installer again in your home folder: `sh install.sh`. It downloads the new release, moves `QUOTE_VERSION` in `.env` to it and restarts the app.

In PowerShell, `.env` names the exact version to run (`QUOTE_VERSION`), so `docker compose pull` alone changes nothing. Download the new bundle over the old one (your `.env` is kept), set `QUOTE_VERSION` to the new release from the [releases page](https://github.com/sychen6192/quote-system/releases) (for example `1.1.0`, or `1` to follow every 1.x release), then start it:

```powershell
cd $HOME\quote-system
curl.exe -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/quote-system-deploy.tar.gz
tar -xzf quote-system-deploy.tar.gz
notepad .env                # set QUOTE_VERSION to the new release, then save
docker compose pull
docker compose up -d
```

Database migrations run automatically when the new version starts. The new bundle replaces `docker-compose.yml`: keep your own changes in `docker-compose.override.yml`.
