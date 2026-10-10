# HTTPS and installing the app

[繁體中文](https.zh-TW.md)

Quote System works over plain HTTP, but browsers only **install** web apps (and only run their service worker) from a secure address: `https://…`, or `http://localhost` on the same computer. To put the app on phones' home screens, give it an HTTPS address with one of the three options below.

| Option | Good for | You need | Devices need |
|---|---|---|---|
| [1. Caddy with its own CA](#1-caddy-with-its-own-certificate-authority) | Office or home network | Nothing extra | To trust one certificate, once |
| [2. A real domain](#2-a-real-domain) | Access from anywhere | A domain, ports 80 and 443 open to the internet | Nothing |
| [3. Tailscale or Cloudflare Tunnel](#3-tailscale-or-cloudflare-tunnel) | Remote access without open ports | A free Tailscale or Cloudflare account | Tailscale app (Tailscale only) |

All commands run in your install directory (`~/quote-system` by default).

## 1. Caddy with its own certificate authority

The bundle includes [Caddy](https://caddyserver.com), a web server that handles certificates by itself. For addresses that cannot get a public certificate (an IP, `localhost`, `*.local`, `*.internal`, `*.home.arpa`), Caddy signs certificates with its own local certificate authority (CA).

1. Edit `.env`:

   ```ini
   # The address people type, e.g. the server's fixed LAN IP or a name your router's DNS resolves
   SITE_ADDRESS=192.168.1.20
   # Only for other private names such as quote.office:
   # CADDY_TLS=tls internal
   # Only Caddy should be reachable from other machines
   APP_BIND=127.0.0.1
   # Start Caddy with the plain `docker compose up -d`
   COMPOSE_PROFILES=https
   ```

   Give the server a fixed IP (a DHCP reservation in your router) so the address does not change. If ports 80 or 443 are taken (NAS web interfaces often use them), set `HTTP_PORT=8081` and `HTTPS_PORT=8443` and open `https://192.168.1.20:8443` (plain `http://192.168.1.20:8081` redirects there).

2. Start it and check the address:

   ```sh
   docker compose up -d
   curl -k https://192.168.1.20/api/health     # {"status":"ok"}
   ```

3. Copy Caddy's root certificate out of the container:

   ```sh
   docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
   ```

   The CA lives in the `caddy_data` volume and stays the same across restarts and upgrades. If you delete that volume, Caddy creates a new CA and every device has to trust the new one.

4. Trust `caddy-root.crt` on each device (send it by email, AirDrop, a chat app or a USB stick):

   - **iPhone and iPad:** open the file and tap **Allow** to download the profile. Go to **Settings → General → VPN & Device Management**, tap the profile and **Install**. Then go to **Settings → General → About → Certificate Trust Settings** and turn on full trust for "Caddy Local Authority".
   - **Android:** **Settings → Security & privacy → More security settings → Encryption & credentials → Install a certificate → CA certificate**, then pick the file (menu names vary by phone maker; search Settings for "certificate"). Chrome trusts certificates installed this way.
   - **Windows:** double-click the file → **Install Certificate** → **Local Machine** → **Place all certificates in the following store** → **Trusted Root Certification Authorities**. Restart the browser.
   - **macOS:** double-click the file to add it to the **System** keychain, open it in Keychain Access, expand **Trust** and choose **Always Trust**.
   - **Linux (Chrome):** `certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "Caddy Local Authority" -i caddy-root.crt`
   - **Firefox** keeps its own list: **Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import**.

   Only trust a root certificate you created yourself: whoever holds its key can impersonate any website to that device. The key never leaves the `caddy_data` volume.

5. Open `https://192.168.1.20` on the device. There should be no warning; then [install the app](#installing-the-app).

## 2. A real domain

With a domain name, Caddy gets free, publicly trusted certificates (Let's Encrypt or ZeroSSL) and renews them automatically. No device setup is needed.

1. Create a DNS record, for example an `A` record `quote.example.com` pointing at your public IP.
2. Forward ports **80** and **443** (TCP, and UDP 443 for HTTP/3) from your router to the server. Caddy needs both to obtain certificates.
3. Edit `.env`:

   ```ini
   SITE_ADDRESS=quote.example.com
   APP_BIND=127.0.0.1
   COMPOSE_PROFILES=https
   APP_PASSWORD=<a strong password>
   ```

   (Letters, digits and `. _ ~ ! @ % ^ * + = : , -`, or the whole password in single quotes: see `.env.example`.)

4. `docker compose up -d`, wait a minute, then open `https://quote.example.com`. If it fails, `docker compose logs caddy` explains why (usually DNS not pointing at you yet, or port 80 blocked).

The app is now reachable from the whole internet: keep `APP_PASSWORD` set and the image up to date. To add a second login in front of it, use Cloudflare Access (option 3).

## 3. Tailscale or Cloudflare Tunnel

Both give you a valid `https://` address without opening ports on your router. You do not need the Caddy profile.

### Tailscale (private: only your devices)

1. Install [Tailscale](https://tailscale.com/download) on the server and on every phone and computer that should reach the app, signed in to the same account (tailnet).
2. In the [admin console](https://login.tailscale.com/admin/dns), enable **MagicDNS** and **HTTPS Certificates**.
3. On the server:

   ```sh
   sudo tailscale serve --bg 3000
   ```

4. Open `https://<machine-name>.<tailnet-name>.ts.net` (shown by `tailscale serve status`) on any device in your tailnet.

Keep `APP_BIND=0.0.0.0` (the default) or `127.0.0.1`; Tailscale connects to the app locally. Keep `APP_PASSWORD` set. If you turn sign-in off, the app still answers under the `*.ts.net` name (and logs a one-time warning about it); add that name to `.env`, for example `APP_HOSTS=<machine-name>.<tailnet-name>.ts.net`, and run `docker compose up -d`, so the app refuses every other domain name (protection against DNS rebinding).

### Cloudflare Tunnel (public, with an optional login in front)

1. Add your domain to Cloudflare. In **Zero Trust → Networks → Tunnels**, create a tunnel and copy the connector token.
2. Run the connector next to the app, for example in `docker-compose.override.yml`:

   ```yaml
   services:
     cloudflared:
       image: cloudflare/cloudflared:latest
       command: tunnel --no-autoupdate run
       environment:
         TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}
       restart: unless-stopped
   ```

   and put `CLOUDFLARE_TUNNEL_TOKEN=<token>` in `.env`, then `docker compose up -d`.
3. In the tunnel's **Public hostname** tab, add `quote.example.com` with service `http://app:3000`. Keep `APP_PASSWORD` set; if you turn sign-in off anyway (behind Access, step 4), add `APP_HOSTS=quote.example.com` to `.env` so the app refuses other names.

   Do not also publish port 3000 to your network: the connector reaches the app inside Docker, and anyone who can open `http://<server-ip>:3000` goes around the tunnel and Cloudflare Access. Set `APP_BIND=127.0.0.1` in `.env` and run `docker compose up -d`; port 3000 then only answers on the server itself (a connector installed on the host instead of in Docker uses `http://localhost:3000`, which keeps working).
4. Optional: in **Zero Trust → Access → Applications**, protect `quote.example.com` with a one-time PIN sent to your team's email addresses.

   Browsers fetch some of the files they need to install the app without the Access cookie, and Access answers those requests with its login page. Add a second Access application for the same hostname with these paths and a **Bypass** policy (Everyone), or the install option never appears:

   - `/manifest.webmanifest`
   - `/icons/*`
   - `/sw.js`
   - `/offline.html`

   They hold no quotes or customer data (the app keeps them public even with `APP_PASSWORD` set), and the more specific paths take precedence over the hostname-wide application. Any other login in front of the app (basic auth on a reverse proxy, Authelia, Authentik) needs the same exception.

## Installing the app

Open the HTTPS address, sign in, then:

- **iPhone and iPad (Safari):** tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** tap the **Install** button in the app, or the browser menu → **Install app**.
- **Windows, macOS, Linux (Chrome or Edge):** click the install icon at the right of the address bar, or the app's **Install** button.

The installed app opens in its own window, keeps you signed in for 30 days and shows an offline page when the server cannot be reached. It updates itself: when a new version is deployed, it offers to reload.

## Troubleshooting

- **No install option.** The address bar must show a padlock without warnings. A certificate warning (even if you clicked through) means the device does not trust the certificate yet; repeat step 4 of option 1. On iPhone, use Safari. Behind Cloudflare Access or another login in front of the app, let the install files through (option 3, step 4).
- **"Your connection is not private" after moving the server.** The certificate is issued for `SITE_ADDRESS`; open exactly that address, or change `SITE_ADDRESS` and run `docker compose up -d`.
- **Caddy does not start.** `docker compose logs caddy`. "address already in use" means another program owns port 80 or 443: set `HTTP_PORT` and `HTTPS_PORT`.
- **"Unknown host".** Sign-in is off and `APP_HOSTS` is set, but the address you opened is not in it. Add that host name to `APP_HOSTS` (comma-separated; also any name a reverse proxy sends in `X-Forwarded-Host`) and run `docker compose up -d`.
- **Sign-in loops behind your own reverse proxy.** The app marks its session cookie `Secure` when the proxy sends `X-Forwarded-Proto: https`. If the proxy sends that header while the browser actually uses `http://`, the browser drops the cookie. Send the header only for HTTPS traffic, as the bundled Caddy does.
