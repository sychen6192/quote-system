# Synology 與 QNAP NAS

[English](nas.md)

全天候開機的 NAS 很適合用來執行 Quote System。映像檔支援 **x86-64（amd64）** 與 **64 位元 ARM（arm64）** 機種，32 位元 ARM 機種無法執行；請先到原廠網站確認你的機種所用的 CPU。以下選單名稱以 DSM 7.2 與 QTS 5.1 為準，其他版本可能略有不同。

## Synology（DSM 7.2 以上）

請先在套件中心安裝 **Container Manager**。

### 方式 A：透過 SSH 執行安裝程式（建議）

1. 「**控制台 → 終端機和 SNMP → 啟動 SSH 功能**」。
2. 在你的電腦上執行：

   ```sh
   ssh <管理員帳號>@<NAS IP>
   curl -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/install.sh
   sudo QUOTE_DIR=/volume1/docker/quote-system sh install.sh
   ```

   DSM 上的 Docker 需要 `sudo`。請記下安裝程式最後顯示的登入密碼。
3. 開啟 `http://<NAS IP>:3000`。Container Manager 的「**專案**」中也會出現這個專案。

若出現找不到 `docker compose` 的訊息，請改用方式 B。

### 方式 B：只用 Container Manager

1. 在電腦上從[最新版本](https://github.com/sychen6192/quote-system/releases/latest)下載 `quote-system-deploy.tar.gz` 並解壓縮（Windows 可用 7-Zip，macOS 直接雙擊）。
2. 將 `.env.example` 複製一份並命名為 `.env`，設定 `POSTGRES_PASSWORD`（只用英文字母與數字）、`AUTH_SECRET`（32 個以上的隨機字元）與 `APP_PASSWORD`。
3. 在 File Station 建立 `docker/quote-system` 資料夾，上傳 `docker-compose.yml`、`Caddyfile` 與 `.env`，並在其中建立空的 `branding` 與 `backups` 資料夾。
4. 「**Container Manager → 專案 → 新增**」：專案名稱填 `quote-system`，路徑選 `docker/quote-system`，選擇「**使用現有的 docker-compose.yml**」，再按「**下一步 → 完成**」。

### 在 Synology 上設定 HTTPS

DSM 本身會使用 80 與 443 埠，因此請改用 DSM 內建的反向代理，而不是發行套件中的 Caddy：

1. 取得憑證：「**控制台 → 外部存取 → DDNS**」（例如 `yourname.synology.me`），再到「**控制台 → 安全性 → 憑證 → 新增 → Let's Encrypt**」。若 DDNS 服務支援子網域，可加入 `quote.yourname.synology.me` 這類 App 專用名稱，或使用你自己的網域。
2. 「**控制台 → 登入入口 → 進階 → 反向代理伺服器 → 新增**」：
   - 來源：通訊協定 **HTTPS**、主機名稱 `quote.yourname.synology.me`、連接埠 **443**
   - 目的地：通訊協定 **HTTP**、主機名稱 `localhost`、連接埠 **3000**
   - 自訂標頭：新增 `X-Forwarded-Proto`，值為 `https`
3. 「**控制台 → 安全性 → 憑證 → 設定**」：為新的反向代理項目指定該憑證。
4. 開啟 `https://quote.yourname.synology.me`，接著[安裝 App](https.zh-TW.md#安裝-app)。

若要從外部網路連線，還需要把 443 埠轉發到 NAS。若只想讓自己的裝置連線，也可以使用 DSM 的 Tailscale 套件搭配 `tailscale serve`（見〈[HTTPS 設定指南](https.zh-TW.md#tailscale私人網路只有你的裝置能連)〉）。

### 在 Synology 上備份

啟動一次備份服務（SSH：`cd /volume1/docker/quote-system && sudo docker compose --profile backup up -d`，或在 `.env` 加上 `COMPOSE_PROFILES=backup` 後重新建置專案），再把 `docker/quote-system` 加入 **Hyper Backup** 備份工作，讓備份檔與 `.env` 另存到 NAS 以外的地方。

## QNAP（QTS 5.1／QuTS hero，搭配 Container Station 3）

請先在 App Center 安裝 **Container Station**，並啟用 SSH（「**控制台 → 網路與檔案服務 → Telnet／SSH**」）。

```sh
ssh admin@<NAS IP>
curl -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/install.sh
sudo QUOTE_DIR=/share/Container/quote-system sh install.sh
```

開啟 `http://<NAS IP>:3000`，Container Station 中也會列出這些容器。

QTS 的管理介面使用 8080 與 443 埠。若要設定 HTTPS，可使用「**控制台 → 網路與檔案服務 → 網路存取 → 反向代理**」（QTS 5.1 以上）指向 `http://localhost:3000`，並搭配 myQNAPcloud 或你自己的憑證；或者讓發行套件中的 Caddy 改用其他連接埠（在 `.env` 設定 `HTTP_PORT=8081`、`HTTPS_PORT=8443`），詳見〈[HTTPS 設定指南](https.zh-TW.md)〉。

備份方面，請如上啟用 backup profile，並將 `/share/Container/quote-system` 加入 **Hybrid Backup Sync** 備份工作。

## 在 NAS 上升級

透過 SSH 在安裝目錄中執行：

```sh
sudo docker compose pull && sudo docker compose up -d
```

或以相同的 `QUOTE_DIR` 再執行一次安裝程式。資料庫會自動升級。
