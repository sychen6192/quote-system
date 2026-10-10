# HTTPS 設定與安裝 App

[English](https.md)

Quote System 用一般的 HTTP 就能正常使用，但瀏覽器只允許從安全網址**安裝** App（Service Worker 也只在安全網址下運作）：也就是 `https://…`，或同一台電腦上的 `http://localhost`。若要把 App 加到手機主畫面，請從以下三種方式擇一，為系統準備 HTTPS 網址。

| 方式 | 適合情境 | 你需要準備 | 每台裝置需要 |
|---|---|---|---|
| [1. Caddy 自有憑證](#1-caddy-自有憑證) | 公司或家中區網 | 不需額外準備 | 信任一次根憑證 |
| [2. 自己的網域](#2-自己的網域) | 從任何地方連線 | 一個網域，並開放 80 與 443 埠 | 不需設定 |
| [3. Tailscale 或 Cloudflare Tunnel](#3-tailscale-或-cloudflare-tunnel) | 不開放連接埠也能遠端使用 | 免費的 Tailscale 或 Cloudflare 帳號 | 安裝 Tailscale App（僅 Tailscale） |

以下指令都在安裝目錄（預設為 `~/quote-system`）中執行。

## 1. Caddy 自有憑證

發行套件內含 [Caddy](https://caddyserver.com) 網頁伺服器，會自行處理憑證。對於無法取得公開憑證的位址（IP、`localhost`、`*.local`、`*.internal`、`*.home.arpa`），Caddy 會用自己的本機憑證機構（CA）簽發憑證。

1. 編輯 `.env`：

   ```ini
   # 使用者輸入的網址，例如伺服器的固定區網 IP，或路由器 DNS 可解析的名稱
   SITE_ADDRESS=192.168.1.20
   # 只有 quote.office 這類其他私有名稱才需要：
   # CADDY_TLS=tls internal
   # 只讓 Caddy 對其他電腦開放
   APP_BIND=127.0.0.1
   # 一般的 docker compose up -d 也會啟動 Caddy
   COMPOSE_PROFILES=https
   ```

   請在路由器為伺服器設定固定 IP（DHCP 保留），網址才不會變動。若 80 或 443 埠已被占用（NAS 的管理介面常會使用），請設定 `HTTP_PORT=8080` 與 `HTTPS_PORT=8443`，並改用 `https://192.168.1.20:8443` 開啟。

2. 啟動並確認網址可以連線：

   ```sh
   docker compose up -d
   curl -k https://192.168.1.20/api/health     # {"status":"ok"}
   ```

3. 從容器中取出 Caddy 的根憑證：

   ```sh
   docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
   ```

   這個 CA 存放在 `caddy_data` volume 中，重新啟動或升級都不會改變。若刪除該 volume，Caddy 會建立新的 CA，每台裝置都得重新信任。

4. 在每台裝置上信任 `caddy-root.crt`（可透過 Email、AirDrop、通訊軟體或隨身碟傳送）：

   - **iPhone 與 iPad**：開啟檔案並點「**允許**」下載描述檔。前往「**設定 → 一般 → VPN 與裝置管理**」，點選描述檔後選「**安裝**」。接著到「**設定 → 一般 → 關於本機 → 憑證信任設定**」，為「Caddy Local Authority」開啟完全信任。
   - **Android**：「**設定 → 安全性與隱私權 → 更多安全性設定 → 加密與憑證 → 安裝憑證 → CA 憑證**」，再選擇檔案（各品牌選單名稱略有不同，可在設定中搜尋「憑證」）。Chrome 會信任以此方式安裝的憑證。
   - **Windows**：雙擊檔案 →「**安裝憑證**」→「**本機電腦**」→「**將所有憑證放入以下的存放區**」→「**受信任的根憑證授權單位**」，完成後重新開啟瀏覽器。
   - **macOS**：雙擊檔案將它加入「**系統**」鑰匙圈，在「鑰匙圈存取」中開啟該憑證，展開「**信任**」並選擇「**永遠信任**」。
   - **Linux（Chrome）**：`certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "Caddy Local Authority" -i caddy-root.crt`
   - **Firefox** 有自己的憑證清單：「**設定 → 隱私權與安全性 → 憑證 → 檢視憑證 → 憑證機構 → 匯入**」。

   請只信任你自己建立的根憑證：持有其私鑰的人可以對該裝置冒充任何網站。這把私鑰只存在 `caddy_data` volume 中，不會外流。

5. 在裝置上開啟 `https://192.168.1.20`，應該不會出現任何警告，接著就可以[安裝 App](#安裝-app)。

## 2. 自己的網域

有網域時，Caddy 會自動申請並更新受信任的免費憑證（Let's Encrypt 或 ZeroSSL），裝置端不需任何設定。

1. 建立 DNS 記錄，例如將 `A` 記錄 `quote.example.com` 指向你的對外 IP。
2. 在路由器將 **80** 與 **443** 埠（TCP，HTTP/3 另需 UDP 443）轉發到伺服器。Caddy 需要這兩個埠才能取得憑證。
3. 編輯 `.env`：

   ```ini
   SITE_ADDRESS=quote.example.com
   APP_BIND=127.0.0.1
   COMPOSE_PROFILES=https
   APP_PASSWORD=<夠強的密碼>
   ```

4. 執行 `docker compose up -d`，稍等一分鐘後開啟 `https://quote.example.com`。若無法連線，`docker compose logs caddy` 會說明原因（通常是 DNS 尚未生效，或 80 埠被擋）。

此時整個網際網路都能連到這個 App：請務必設定 `APP_PASSWORD`，並保持映像檔為最新版本。若想在前面再加一道登入，可使用 Cloudflare Access（方式 3）。

## 3. Tailscale 或 Cloudflare Tunnel

兩者都不必在路由器開放連接埠，就能取得有效的 `https://` 網址，也不需要啟用 Caddy profile。

### Tailscale（私人網路：只有你的裝置能連）

1. 在伺服器以及每台要使用的手機、電腦上安裝 [Tailscale](https://tailscale.com/download)，並登入同一個帳號（tailnet）。
2. 在[管理後台](https://login.tailscale.com/admin/dns)啟用 **MagicDNS** 與 **HTTPS Certificates**。
3. 在伺服器上執行：

   ```sh
   sudo tailscale serve --bg 3000
   ```

4. 在 tailnet 內的任一裝置開啟 `https://<主機名稱>.<tailnet 名稱>.ts.net`（可用 `tailscale serve status` 查詢）。

`APP_BIND` 維持 `0.0.0.0`（預設）或設為 `127.0.0.1` 皆可；Tailscale 會從本機連到 App。

### Cloudflare Tunnel（公開網址，可在前面加一道登入）

1. 將你的網域加入 Cloudflare。在「**Zero Trust → Networks → Tunnels**」建立 Tunnel，並複製 connector token。
2. 在 App 旁執行 connector，例如寫在 `docker-compose.override.yml`：

   ```yaml
   services:
     cloudflared:
       image: cloudflare/cloudflared:latest
       command: tunnel --no-autoupdate run
       environment:
         TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}
       restart: unless-stopped
   ```

   並在 `.env` 加上 `CLOUDFLARE_TUNNEL_TOKEN=<token>`，再執行 `docker compose up -d`。
3. 在該 Tunnel 的「**Public hostname**」分頁新增 `quote.example.com`，服務設為 `http://app:3000`。
4. 選用：在「**Zero Trust → Access → Applications**」保護 `quote.example.com`，只允許團隊的 Email 以一次性驗證碼登入。

## 安裝 App

開啟 HTTPS 網址並登入後：

- **iPhone 與 iPad（Safari）**：點「**分享**」，再選「**加入主畫面**」。
- **Android（Chrome）**：點 App 內的「**安裝**」按鈕，或瀏覽器選單 →「**安裝應用程式**」。
- **Windows、macOS、Linux（Chrome 或 Edge）**：點網址列右側的安裝圖示，或 App 內的「**安裝**」按鈕。

安裝後的 App 會在獨立視窗開啟，登入狀態維持 30 天，連不到伺服器時會顯示離線頁面。App 會自動更新：部署新版本後，會提示你重新載入。

## 疑難排解

- **找不到安裝選項**：網址列必須顯示鎖頭且沒有任何警告。出現憑證警告（即使已點選繼續前往）代表裝置尚未信任該憑證，請重做方式 1 的第 4 步。iPhone 請使用 Safari。
- **搬移伺服器後出現「你的連線不是私人連線」**：憑證是針對 `SITE_ADDRESS` 簽發的，請開啟完全相同的網址，或修改 `SITE_ADDRESS` 後執行 `docker compose up -d`。
- **Caddy 無法啟動**：查看 `docker compose logs caddy`。出現「address already in use」表示 80 或 443 埠已被其他程式占用，請設定 `HTTP_PORT` 與 `HTTPS_PORT`。
- **在自己的反向代理後面一直被要求重新登入**：當代理伺服器送出 `X-Forwarded-Proto: https` 時，App 會將 Session Cookie 標記為 `Secure`。若代理送出這個標頭、瀏覽器實際卻使用 `http://`，瀏覽器就會捨棄該 Cookie。請只在 HTTPS 連線時送出這個標頭，就像內建的 Caddy 一樣。
