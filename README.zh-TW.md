# Quote System 報價系統

**給中小企業自行架設的報價單系統。** 用手機或電腦開報價單，寄出中英文皆可的正式 PDF，隨時掌握哪些案子還在等回覆、哪些已成交、哪些即將到期。資料存在你自己的資料庫裡；一行指令就能安裝，公司資料在「設定」頁面填好即可開始使用。

[English → README.md](README.md)

<p align="center">
  <img src="docs/images/dashboard.zh-TW.png" alt="儀表板：洽談中金額、成交率、即將到期與最近的報價單" width="860">
</p>

## 功能特色

- **專業的報價單**：邊輸入邊看 A4 即時預覽（點預覽中任何位置就能直接修改）；品項可加說明、單位與小數數量，可區分應稅與免稅品項；折扣可用金額或百分比，另有其他費用欄位；自動產生中文大寫金額（新台幣壹萬貳仟元整）。
- **中英文 PDF**：由伺服器產生 A4 PDF 並內嵌思源黑體（Noto Sans TC），中文在任何裝置都能正確顯示與列印。可下載、列印，也能直接從手機分享。
- **Email 寄送**：透過 [Resend](https://resend.com) 寄出報價單並附上 PDF，收件人、副本與內文都能修改。
- **案件狀態一目了然**：儀表板顯示洽談中金額、本月成交、成交率與草稿數量，以及 7 天內到期的報價單；報價單有完整狀態流程（草稿、已發送、已成交、已拒絕、已過期）與異動紀錄；可在列表直接改狀態，下載或分享 PDF 後一鍵標記為已發送。
- **快速輸入**：點公司名稱或品名，就能從清單選最近用過的客戶或品項，自動帶入聯絡資料、上次的付款條件與單價（也可搜尋全部），業務人員也會記住；一鍵複製報價單、常用付款條件與有效期限一鍵套用、草稿自動儲存與還原，按 Ctrl/⌘+S 即可儲存。可選用統一編號查詢公司資料。
- **客戶名錄**：列出每位客戶的報價次數、成交金額，一鍵為該客戶新增報價單。
- **在 App 內完成設定**：公司資料、Logo、公司大小章、App 圖示、品牌色、報價單編號規則（`QT-{YYYY}{MM}{DD}-{SEQ:3}`，支援民國年）、預設稅率、條款、匯款帳戶、寄件者、幣別與時區，全部都在「設定」頁面調整。
- **可安裝的 App（PWA）**：加到手機主畫面或電腦的 Dock／工作列，以獨立視窗開啟；網路中斷時會顯示友善的離線頁面。
- **手機、電腦都好用**：手機版有底部分頁列與固定操作列，電腦版支援鍵盤快捷鍵；淺色／深色主題；介面支援繁體中文與英文。
- **自架也安心**：可選擇啟用密碼登入、資料庫自動升級（migration）、CSV 匯出、排程備份；Docker 映像檔支援 amd64 與 arm64，並以非 root 使用者執行。

<p align="center">
  <img src="docs/images/quote-editor.zh-TW.png" alt="報價單編輯畫面，右側即時顯示 A4 預覽" width="860">
</p>

<p align="center">
  <img src="docs/images/mobile.png" alt="手機畫面：儀表板、深色主題的報價單列表，以及附 PDF 預覽的報價單" width="860">
</p>

## 5 分鐘完成安裝

需要一台已安裝 [Docker](https://docs.docker.com/engine/install/) 與 Docker Compose v2.17 以上版本的電腦、伺服器或 NAS（Windows 與 macOS 的 Docker Desktop 已內含兩者）。支援 amd64 與 arm64 的 Linux，例如安裝 64 位元系統的 Raspberry Pi 4／5。

### 使用安裝程式

```sh
curl -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/install.sh
less install.sh    # 可先看看它會做什麼
sh install.sh
```

安裝程式會：

1. 檢查 Docker 與 Compose；
2. 下載發行套件（`docker-compose.yml`、`Caddyfile`、`.env.example`）到 `~/quote-system`，並驗證 SHA-256 檢查碼；
3. 建立 `.env`，自動產生隨機的資料庫密碼、Session 金鑰與**登入密碼**（登入密碼只會在最後顯示一次，另存於 `.env`）；
4. 啟動 App 與資料庫，等到兩者都正常運作才結束。

用瀏覽器開啟畫面上顯示的網址（例如 `http://192.168.1.20:3000`），輸入密碼即可登入。

選項以環境變數指定，例如 `QUOTE_DIR=/opt/quote-system QUOTE_VERSION=1.0.0 APP_PORT=8080 sh install.sh`。設定 `APP_PASSWORD=`（空值）則不啟用登入；加上 `COMPOSE_PROFILES=https` 會一併啟動提供 HTTPS 的 Caddy（見下文）。之後再執行一次安裝程式就會升級到最新版，`.env` 與資料都會保留。只要 `https` profile 已啟用（寫在 `COMPOSE_PROFILES`，或曾手動啟動 Caddy），而 `APP_BIND` 是空值，安裝程式就會設為 `APP_BIND=127.0.0.1`，讓其他電腦只能透過 Caddy 連線；你自己設定過的 `APP_BIND` 則會保留。

### 手動以 Docker Compose 安裝

```sh
mkdir quote-system && cd quote-system
curl -fsSL https://github.com/sychen6192/quote-system/releases/latest/download/quote-system-deploy.tar.gz | tar -xz
cp .env.example .env
```

編輯 `.env`，至少設定以下三個值（`openssl rand -hex 24` 可產生合適的隨機字串）：

```ini
POSTGRES_PASSWORD=<只用英文字母與數字>
AUTH_SECRET=<至少 32 個隨機字元>
APP_PASSWORD=<大家共用的登入密碼>
```

`APP_PASSWORD` 可使用英文字母、數字與 `. _ ~ ! @ % ^ * + = : , -`。若要用其他字元，請用單引號把整組密碼括起來（`APP_PASSWORD='Acme$ecure #2026'`）：Docker Compose 讀取 `.env` 時，會把 `$name` 當成變數換成空字串，並在「空格加 `#`」處截斷，結果用你輸入的密碼反而登入不了。

接著啟動：

```sh
docker compose up -d
```

App 預設使用 3000 埠（`APP_PORT`），資料庫不會對外開放任何連接埠。Windows 請改用〈[Windows 與 macOS 的 Docker Desktop](docs/deploy/docker-desktop.zh-TW.md)〉中的 PowerShell 步驟（使用 `curl.exe`，每行一個指令）；Synology 與 QNAP 請參考〈[NAS 安裝說明](docs/deploy/nas.zh-TW.md)〉。

## 首次設定

開啟「**設定**」頁面（完成前，儀表板會顯示設定清單）：

| 分頁 | 填寫內容 |
|---|---|
| 公司資料 | 公司名稱（可另填中文或在地名稱）、地址、統一編號、Email、電話、網站 |
| 品牌形象 | Logo 與公司大小章（PNG 或 JPEG，1 MB 以內）、App 圖示、品牌色 |
| 報價單 | 編號規則、有效天數、預設稅率、預設備註與條款、業務人員、中文大寫金額、PDF 頁尾 |
| 付款資訊 | 銀行名稱、銀行代碼、戶名與帳號（會印在報價單上） |
| 電子郵件 | 寄件者名稱與地址、副本、回覆地址（Resend API 金鑰本身仍設定在 `.env`） |
| 地區與幣別 | 幣別、金額格式、時區、統一編號查詢 |
| 關於 | 版本、郵件寄送與登入保護狀態、安裝 App、CSV 匯出 |

這裡儲存的設定都存在資料庫中，優先於 `.env`，也會一併包含在資料庫備份裡。

## HTTPS 與手機安裝

瀏覽器只允許從安全網址安裝 App：`https://…`，或同一台電腦上的 `http://localhost`。一般的 `http://192.168.1.20:3000` 可以正常使用所有功能，只是手機上不會出現「安裝」選項。以下三種方式擇一：

1. **使用 Caddy 自有憑證（公司或家中區網）**：在 `.env` 將 `SITE_ADDRESS` 設為伺服器 IP 或 `quote.local` 這類名稱，並設定 `APP_BIND=127.0.0.1`，接著執行 `docker compose --profile https up -d`，再開啟 `https://<SITE_ADDRESS>`。每台裝置都要先信任一次 Caddy 的根憑證（iPhone、iPad、Android、Windows 與 macOS 的步驟請見〈[HTTPS 設定指南](docs/deploy/https.zh-TW.md)〉）。
2. **使用自己的網域**：將 `quote.example.com` 之類的 DNS 記錄指向伺服器，並讓 80 與 443 埠可從網際網路連入，設定 `SITE_ADDRESS=quote.example.com` 與 `APP_BIND=127.0.0.1` 後執行 `docker compose --profile https up -d`。Caddy 會自動申請並更新免費憑證。請務必設定 `APP_PASSWORD`。
3. **使用 Tailscale 或 Cloudflare Tunnel（不必開放連接埠）**：執行 `tailscale serve --bg 3000`，tailnet 內的每台裝置都能透過 `https://<主機名稱>.<tailnet>.ts.net` 以有效憑證連線；Cloudflare Tunnel 則可把 App 發布到你的網域，並可搭配 Cloudflare Access 在前面再加一道登入。

接著安裝 App：

- **iPhone 與 iPad**：用 Safari 開啟網址，點「**分享**」，再選「**加入主畫面**」。
- **Android**：在 Chrome 點選選單，再選「**安裝應用程式**」（或使用 App 內的「**安裝**」按鈕）。
- **Windows、macOS、Linux**：在 Chrome 或 Edge 網址列點安裝圖示，或使用 App 內的「**安裝**」按鈕。

在 `.env` 加上 `COMPOSE_PROFILES=https`，之後執行 `docker compose up -d` 時就會一併啟動 Caddy。

## 設定參考

能在「設定」頁面調整的項目，建議直接在頁面上設定；`.env` 的環境變數可作為這些欄位的預設值，也用來設定只該由伺服器掌握的資訊。優先順序（逐欄判斷）：**設定頁面 > `.env` > 系統預設值**。修改 `.env` 後請執行 `docker compose up -d` 套用。

### 伺服器與安全性

| 變數 | 預設值 | 用途 |
|---|---|---|
| `DATABASE_URL` | 由 `docker-compose.yml` 設定 | PostgreSQL 連線字串（不使用發行套件時必填） |
| `POSTGRES_PASSWORD` | 無，必填 | 內建 PostgreSQL 的資料庫密碼（限英文字母與數字），只在資料庫首次建立時套用 |
| `APP_PASSWORD` | 空值（不需登入） | 共用登入密碼；修改後所有人都會被登出 |
| `AUTH_SECRET` | 由 `APP_PASSWORD` 推導，並記錄警告 | 簽署 Session Cookie 的隨機字串，至少 32 個字元 |
| `APP_HOSTS` | 空值（接受任何主機名稱） | 只在不需登入時使用。空值時，App 接受任何主機名稱；第一次以非區網名稱連入時，會記錄一則警告（每次啟動只記一次）。設定為你實際使用的名稱（以逗號分隔，例如 `quote.example.com`、`*.example.com`）後，其他名稱一律回應「Unknown host」（HTTP 421），藉此防範 DNS rebinding 攻擊。IP 位址、`localhost`、不含點的名稱、以 `.local`、`.lan`、`.home`、`.home.arpa`、`.internal`、`.localdomain` 或 `.localhost` 結尾的名稱，以及 `SITE_ADDRESS` 一律可用；設為 `*` 則接受所有名稱，也不再警告 |
| `TRUST_PROXY_HOPS` | `1` | App 前方會在 `X-Forwarded-For` 附加位址的反向代理數量，只用來區分登入、寄信與統編查詢頻率限制的來源；例如 Cloudflare 後面再接 NAS 反向代理時請設為 `2` |
| `APP_NAME` | 公司名稱，其次為「Quote System」 | 安裝後 App 顯示的名稱 |
| `APP_TIMEZONE` | `TZ`，其次為 `Asia/Taipei` | IANA 時區，決定報價日期、編號與到期判斷所用的「今天」 |
| `RESEND_API_KEY` | 空值（不寄信） | [Resend](https://resend.com) API 金鑰，只從環境變數讀取 |
| `DB_POOL_MAX` | `10` | 每個 App 實例的資料庫連線數（1–100） |
| `SKIP_DB_MIGRATIONS` | `false` | 設為 `true` 則啟動時不自動升級資料庫（請自行執行 `npm run db:migrate`） |
| `PWA_DISABLE_SW` | `false` | 緊急開關：設為 `true` 時，Service Worker 會在每台裝置上清除快取並自行移除 |

### 設定頁面的預設值

| 變數 | 預設值 | 對應的設定欄位 |
|---|---|---|
| `COMPANY_NAME` | `Your Company` | 公司名稱 |
| `COMPANY_NAME_LOCAL` | 不顯示 | 在地語言名稱，顯示在主要名稱下方 |
| `COMPANY_ADDRESS`、`COMPANY_EMAIL`、`COMPANY_PHONE` | 不顯示 | 聯絡資訊 |
| `COMPANY_VAT_NUMBER` | 不顯示 | 統一編號 |
| `COMPANY_WEBSITE` | 不顯示 | 網站（`example.com` 或完整的 `https://` 網址） |
| `BANK_NAME`、`BANK_CODE`、`BANK_ACCOUNT_NAME`、`BANK_ACCOUNT_NUMBER` | 不顯示 | 匯款資訊區塊（全部空白時隱藏） |
| `QUOTE_NUMBER_PATTERN` | `QT-{YYYY}{MM}{DD}-{SEQ:3}` | 編號規則；可用 `{YYYY}` `{YY}` `{ROC}`（民國年）`{MM}` `{DD}`，以及一個 `{SEQ}` 或 `{SEQ:n}` |
| `QUOTE_VALIDITY_DAYS` | `30` | 新報價單的有效天數（1–365） |
| `DEFAULT_TAX_RATE` | `5` | 新報價單的稅率（%，0–100） |
| `DEFAULT_NOTES`、`DEFAULT_TERMS` | 空值 | 新報價單的備註與條款（以 `\n` 換行） |
| `CURRENCY` | `TWD` | ISO 4217 幣別代碼 |
| `CURRENCY_LOCALE` | `zh-TW` | 金額格式所用的語系，與介面語言無關 |
| `BRAND_COLOR` | `#1D4ED8` | 品牌色（`#RRGGBB`），用於按鈕、PDF 強調色與安裝後的 App |
| `MAIL_SENDER_NAME` | 公司名稱 | 寄件者名稱 |
| `MAIL_SENDER_EMAIL` | `onboarding@resend.dev`（僅供測試） | 寄件地址，網域須先在 Resend 完成驗證 |
| `MAIL_CC_EMAILS` | 無 | 副本收件人，以逗號分隔 |
| `MAIL_REPLY_TO` | 寄件地址 | 回覆地址 |
| `TW_VAT_LOOKUP` | `false` | 設為 `true` 顯示統一編號查詢按鈕（使用經濟部商工登記公示資料） |

### Docker 發行套件（`deploy/docker-compose.yml`）

| 變數 | 預設值 | 用途 |
|---|---|---|
| `QUOTE_VERSION` | 安裝時的版本 | 映像檔標籤：`1.0.0`、`1.0`、`1` 或 `latest` |
| `QUOTE_IMAGE` | `ghcr.io/sychen6192/quote-system` | 映像檔來源（使用鏡像站或自行建置時） |
| `APP_PORT`／`APP_BIND` | `3000`／`0.0.0.0`（空值） | App 在主機上的連接埠與位址；搭配 Caddy 時請用 `APP_BIND=127.0.0.1`（`APP_BIND` 為空值時，安裝程式會自動設定） |
| `SITE_ADDRESS` | `localhost` | Caddy 對外提供服務的網域、IP 或區網名稱（https profile） |
| `CADDY_TLS` | 空值 | 設為 `tls internal` 時，`quote.office` 這類私有名稱也改用 Caddy 自有憑證 |
| `HTTP_PORT`／`HTTPS_PORT` | `80`／`443` | Caddy 在主機上的連接埠 |
| `COMPOSE_PROFILES` | 空值 | 要隨一般指令一起啟動的選用服務：`https`、`backup` 或 `https,backup` |
| `BACKUP_KEEP_DAYS` | `14` | 備份保留天數（backup profile） |
| `BACKUP_INTERVAL_SECONDS` | `86400` | 備份間隔秒數（backup profile） |
| `POSTGRES_USER`／`POSTGRES_DB` | `postgres`／`quote-system` | 資料庫使用者與名稱 |

請以 `KEY=value` 格式填寫，不要加引號；唯一的例外是含有英文字母、數字與 `. _ ~ ! @ % ^ * + = : , -` 以外字元的 `APP_PASSWORD`，需以單引號括起來（見〈[手動以 Docker Compose 安裝](#手動以-docker-compose-安裝)〉）。品牌圖片也可以沿用舊做法：在 `docker-compose.yml` 旁的 `branding/` 資料夾放入 `logo.png`、`stamp.png`、`icon.png`；在設定頁面上傳的圖片會優先使用。

## 密碼保護

設定 `APP_PASSWORD` 後即啟用登入（安裝程式會自動產生隨機密碼）。所有人共用同一組密碼，登入狀態維持 30 天。

- 修改 `.env` 中的密碼並執行 `docker compose up -d`，所有人都會被登出。密碼請使用英文字母、數字與 `. _ ~ ! @ % ^ * + = : , -`，或用單引號把整組密碼括起來。
- 輸錯密碼有次數限制。次數記在記憶體中（App 重新啟動就歸零）；登入成功會把該瀏覽器或該來源位址的次數歸零，也不會計入共用上限。
  - 曾在這裡登入成功的瀏覽器會保存一個裝置 Cookie（`qs_device`，效期 400 天，只會送往登入 API），並單獨計算：輸錯 5 次後最多要等 15 分鐘。下面兩項限制都不適用於它，所以別處的人亂猜密碼，也無法把它擋在門外。修改 `APP_PASSWORD` 或 `AUTH_SECRET` 後，所有裝置 Cookie 都會失效。
  - 其他瀏覽器：同一個來源位址輸錯 5 次後，該位址最多暫停登入 15 分鐘。此外，因為直接連到 App 的用戶端可以自行捏造位址，這類瀏覽器合計每分鐘最多只能失敗 30 次；達到這個共用上限時，從未在此登入過的瀏覽器最多要等 1 分鐘，登入過的瀏覽器與目前已登入的使用者則不受影響。
  - 來源位址取自 `X-Forwarded-For` 中由最近一層代理寫入的項目（內建的 Caddy 會設定）。如果 App 前面有好幾層代理都會附加這個標頭，請把 `TRUST_PROXY_HOPS` 設為代理的層數。
- Session Cookie 設有 `HttpOnly` 與 `SameSite=Lax`；透過 HTTPS 連線時（由 Caddy 告知 App）也會加上 `Secure`。
- `/api/health` 以及 App 圖示與 manifest 維持公開，讓健康檢查與安裝 App 正常運作。

未設定密碼時，任何能連到該連接埠的人都能查看與修改你的報價單，所以請保留安裝程式設定的密碼。沒有設定 `APP_PASSWORD` 的系統絕對不要對外公開；需要對外時也請盡量使用 HTTPS。若在可信任的區網內關閉登入，又透過網域名稱連線（NAS 反向代理、Tailscale 的 `*.ts.net`、Tunnel），請把這些名稱寫進 `APP_HOSTS`：其他名稱會一律回應「Unknown host」，網頁就無法透過 DNS rebinding 連到 App。沒有設定 `APP_HOSTS` 時，App 接受任何名稱，只會在第一次以 IP 位址、`localhost`、不含點或 `.local` 這類區網名稱及 `SITE_ADDRESS` 以外的名稱連入時，記錄一則警告。Docker 對外開放的連接埠會繞過 ufw 等主機防火牆，若只想讓 Caddy 對外，請設定 `APP_BIND=127.0.0.1`。

## 備份與還原

所有資料都在資料庫裡：報價單、客戶、設定與上傳的圖片。備份資料庫時請連同 `.env` 一起保存（資料庫只接受建立時設定的密碼）。

**自動備份**：執行 `docker compose --profile backup up -d`，每天（`BACKUP_INTERVAL_SECONDS`）會在 `./backups` 寫入一份壓縮的備份檔，並刪除超過 14 天（`BACKUP_KEEP_DAYS`）的舊檔。建議再把這個資料夾另外複製到其他地方。

**手動備份：**

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > quote-$(date +%F).dump
```

**還原**（會刪除目前的資料，再把備份檔還原到空白資料庫）：

```sh
docker compose stop app backup
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < quote-2026-10-09.dump
docker compose start app
```

`pg_restore` 必須在沒有錯誤的情況下完成；若中途出錯而停止，請從 `dropdb` 那一行重新執行。可以還原舊版本產生的備份檔，App 啟動時會自動套用較新的 migration。

搬遷到新伺服器、更換資料庫密碼與升級 PostgreSQL 版本，請參考〈[備份指南](docs/deploy/backup.zh-TW.md)〉。

## 升級

升級前請先備份。最簡單的方式是在安裝目錄中（或以相同的 `QUOTE_DIR`）再執行一次安裝程式：

```sh
curl -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/install.sh
sh install.sh
```

它會下載新的發行套件，把 `.env` 中的 `QUOTE_VERSION` 更新為最新版，保留 `.env` 與資料，並備份你改過的 `docker-compose.yml`（自訂設定請寫在 `docker-compose.override.yml`）。

手動升級：`.env` 會固定在安裝時的版本（`QUOTE_VERSION=1.0.0`），所以只執行 `docker compose pull` 不會有任何變化。請先把 `QUOTE_VERSION` 改成新版本（或設為 `1`，跟著所有 1.x 版本更新），再執行：

```sh
cd ~/quote-system
docker compose pull
docker compose up -d
```

新版本啟動時會自動升級資料庫結構。資料庫升級只能往前：若要退回舊版，請把 `QUOTE_VERSION` 改回舊版本，再依〈[備份與還原](#備份與還原)〉的還原指令還原升級前的備份（這些指令會先清空資料庫，不會留下新版本的資料表），最後一步改用 `docker compose up -d` 取代 `docker compose start app`，App 容器才會以舊版映像檔重新建立。各版本的更新內容請見 [Releases 頁面](https://github.com/sychen6192/quote-system/releases) 與 [CHANGELOG.md](CHANGELOG.md)。

## 開發

需求：Node.js 22 以上與 Docker（執行 PostgreSQL）。

```sh
git clone https://github.com/sychen6192/quote-system.git
cd quote-system
npm ci
cp .env.example .env              # DATABASE_URL 已指向 compose 的資料庫
docker compose up -d postgres     # PostgreSQL 16，位於 127.0.0.1:5432
npm run dev                       # http://localhost:3000，啟動時自動套用 migration
```

開發用的 compose 專案名稱是 `quote-system-dev`（volume 為 `quote-system-dev_postgres_data`），因此即使同一台機器上也以發行套件安裝了 Quote System，也不會動到它的資料庫。

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器 |
| `npm run build`／`npm start` | 建置／啟動正式版 |
| `npm run lint` | ESLint 與 ICU 訊息格式檢查 |
| `npm run typecheck` | TypeScript 型別檢查 |
| `npm test` | Jest 單元測試（設定 `TEST_DATABASE_URL` 時會一併執行整合測試） |
| `npm run test:e2e` | Playwright 冒煙測試：建置並在 3100 埠啟動正式版伺服器，測試桌面與 375 px 手機版面（需要 `DATABASE_URL`） |
| `npm run db:generate` | 修改 `db/schema.ts` 後產生 migration（請提交 `drizzle/` 的輸出） |
| `npm run db:migrate` | 不啟動 App，直接套用 migration |
| `npm run db:studio` | 瀏覽資料庫內容 |
| `docker compose up -d --build` | 從原始碼建置映像檔並搭配 PostgreSQL 執行 |

整合測試會清空資料表，請使用獨立的資料庫：

```sh
docker compose exec postgres createdb -U postgres quote_test
DATABASE_URL=postgres://postgres:postgres@localhost:5432/quote_test npm run db:migrate
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/quote_test npm test
```

若要對已在執行的伺服器跑端對端測試：`E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e`（伺服器有設密碼時，再加上 `E2E_APP_PASSWORD`）。第一次執行前請先以 `npx playwright install chromium` 安裝 Chromium。

Service Worker 只在正式版建置中註冊；若要在 `npm run dev` 中測試，請設定 `NEXT_PUBLIC_ENABLE_SW=1`。

翻譯檔位於 `messages/<語系>/<Namespace>.json`；新增的 namespace 需登記在 `i18n/messages.ts`，單元測試會檢查中英文的鍵值是否一致。

### 持續整合（CI）

每次 push 與 pull request 都會執行 `.github/workflows/pipeline.yml`：

- **ci**：確認 schema 變更都有對應的 migration、lint、型別檢查、以 PostgreSQL 執行單元與整合測試、正式版建置，最後以空資料庫啟動 standalone 伺服器兩次（第一次套用 migration，第二次不應有任何變更）。
- **e2e**：以正式版建置、啟用登入的狀態執行 Playwright 冒煙測試，涵蓋桌面與 375 px 手機版面（失敗時上傳報告）。
- **image**：建置 linux/amd64 與 linux/arm64 多架構映像檔，附 OCI 標籤、provenance 與 SBOM；只有 `main` 分支（`main`、`sha-<commit>`）與版本標籤（`1.2.3`、`1.2`、`1`、`latest`）會推送到 `ghcr.io/sychen6192/quote-system`。
- **release**（`v*.*.*` 標籤）：建立 GitHub Release，附上發行套件、`install.sh` 與 `SHA256SUMS`。

## 系統架構

```mermaid
flowchart TB
  Browser["瀏覽器或已安裝的 App<br/>（Service Worker、離線頁面）"]
  Caddy["Caddy（選用）<br/>HTTPS 憑證"]
  Browser -->|HTTPS| Caddy
  subgraph App["Next.js App（Docker）"]
    Proxy["proxy.ts<br/>登入檢查與語系導向"]
    Pages["頁面與 Server Actions"]
    Routes["Route handlers<br/>PDF、CSV、品牌圖片、PWA、健康檢查"]
    Services["services/ 與 lib/<br/>查詢、金額、編號、設定"]
    Proxy --> Pages & Routes
    Pages & Routes --> Services
  end
  Caddy --> Proxy
  Browser -->|"HTTP（區網）"| Proxy
  Resend["Resend API<br/>（寄信）"]
  DB[("PostgreSQL 16<br/>報價單、設定、圖片")]
  PDF["A4 PDF<br/>（react-pdf、思源黑體）"]
  Pages -.-> Resend
  Services -->|Drizzle ORM| DB
  Routes -.-> PDF
```

- **Next.js 16 App Router**：React Server Components 與 Server Actions；每個 Action 與非公開路由都會再次檢查登入狀態。
- **PostgreSQL + Drizzle ORM**：金額以整數「分」儲存，數量為 `numeric(12,3)`。`drizzle/` 中的 migration 會在啟動時以 advisory lock 套用（`instrumentation.ts`、`lib/db/migrate.ts`），多個實例同時啟動也不會衝突。
- **設定**逐欄分層：資料庫（設定頁面）優先於環境變數，再優先於預設值（`lib/settings/`）。
- **單一文件模型**（`lib/quote-view.ts`）同時供應即時預覽、報價單頁面與 PDF，三者內容永遠一致。
- **PWA**：依品牌設定動態產生 manifest 與圖示；手寫的 Service Worker 只快取靜態資源（不快取報價單、PDF 或 API 回應）；另有中英雙語離線頁面。
- **Docker**：standalone 輸出在建置機器的原生架構上完成，再複製到 amd64 與 arm64 的 `node:22-alpine` 映像檔；以 `node` 使用者執行，並以 `/api/health` 做健康檢查。

```
actions/       Server Actions（報價單、狀態、寄信、設定）
app/           頁面、route handlers、PWA 路由
components/    介面元件（shadcn/ui 基礎元件在 components/ui）
db/            Drizzle schema 與連線
deploy/        自架發行套件（compose、Caddyfile、安裝程式）
docs/          操作指南（docs/deploy）與設計文件
drizzle/       SQL migration
lib/           金額、編號、日期、設定、登入、PDF
messages/      翻譯檔（en、zh-TW）
services/      查詢服務
tests/         Jest 單元測試（tests/unit）與 Playwright 冒煙測試（tests/e2e）
```

## 未來規劃

- 公開分享連結，讓客戶線上檢視並回簽報價單
- 已成交的報價單一鍵轉成發票／請款單
- 每張報價單可使用不同幣別
- 多使用者與角色權限
- 除了 Resend，也支援 SMTP 寄信
- 離線時也能新增、編輯報價單
- 更多語言

歡迎提出想法與 Pull Request：較大的變更請先開 issue 討論，並確認 `npm run lint`、`npm run typecheck` 與 `npm test` 都能通過。

## 致謝

- [Invoify](https://github.com/al1abb/invoify)（Ali Abbasov，MIT 授權）：即時預覽與自動縮放、草稿自動儲存、品項排序、付款條件快捷選項、表單區段索引、PDF 快取、請求頻率限制，以及 Playwright 冒煙測試的輔助函式，皆改寫自該專案。相關檔案開頭附有註明，詳見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
- 部分功能構想參考 Invoice Ninja、Crater 與 InvoicePlane（未使用其程式碼）。
- [shadcn/ui](https://ui.shadcn.com)、[Radix UI](https://www.radix-ui.com)、[Lucide](https://lucide.dev) 圖示，以及 [Noto Sans TC](https://fonts.google.com/noto/specimen/Noto+Sans+TC) 與 [Inter](https://rsms.me/inter/) 字型。

## 授權

[MIT](LICENSE) © 2026 Jack SY Chen。第三方元件及其授權條款請見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
