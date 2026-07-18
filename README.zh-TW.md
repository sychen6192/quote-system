# 報價管理系統 (Quote System)

給中小企業自架的報價單管理系統 — 建立報價、產出 PDF、一鍵寄給客戶。完全**白牌化**:公司資訊、品牌圖檔、幣別與稅率預設全部在執行期注入,任何公司都能用同一份程式(甚至同一個 Docker image)搭配自己的設定直接部署。

[English README → README.md](README.md)

## 功能特色

- **報價單管理** — 建立、編輯、列表;動態增減品項,小計/稅額/總額即時計算
- **金額精確** — 金額以整數「分」儲存、稅率以 basis points 計算,杜絕浮點誤差
- **PDF 匯出** — 伺服器端渲染可列印的 A4 報價單(內建 Noto Sans TC 中文字型)
- **Email 寄送** — 透過 [Resend](https://resend.com) 將報價單(含 PDF 附件)寄給客戶
- **白牌品牌** — 公司資料走環境變數;logo / 公司大小章 / favicon 走圖檔;全部有安全的預設值
- **多語系** — 內建英文與繁體中文(next-intl)
- **型別安全** — Next.js App Router + Server Actions、TypeScript strict、Drizzle ORM、前後端共用 Zod 驗證

## 技術堆疊

Next.js 16 (App Router) · TypeScript · PostgreSQL · Drizzle ORM · shadcn/ui + Tailwind CSS · React Hook Form + Zod · @react-pdf/renderer · react-email + Resend · Jest

## 快速開始

需求:Node.js 22+、Docker(跑 PostgreSQL)。

```bash
git clone https://github.com/sychen6192/quote-system.git
cd quote-system
npm install

# 1. 啟動資料庫
docker compose up -d postgres

# 2. 最小環境設定(其餘變數見 .env.example)
echo 'DATABASE_URL="postgres://postgres:postgres@localhost:5432/quote-system"' > .env

# 3. 建立資料表
npm run db:push

# 4. 啟動
npm run dev
```

完成 — 系統會以佔位品牌("Your Company" + 中性 logo)運作。接著照下方設定換成你的公司。

## 設定

所有設定都在**執行期讀取**,不會烘進 build,因此同一個 Docker image 每家公司都能用。

### 環境變數

複製 `.env.example` 為 `.env` 後填入。除了 `DATABASE_URL` 以外全部選填。

| 變數 | 未設定時 | 用途 |
|---|---|---|
| `DATABASE_URL` | —(必填) | PostgreSQL 連線字串 |
| `COMPANY_NAME` | `Your Company` | 公司主要名稱(頁面、PDF、Email、瀏覽器標題) |
| `COMPANY_NAME_LOCAL` | 不顯示 | 主名稱下方的本地語言名稱(如中文全名) |
| `COMPANY_ADDRESS` | 不顯示 | 地址 |
| `COMPANY_VAT_NUMBER` | 不顯示 | 統一編號/稅籍編號 |
| `COMPANY_EMAIL` | 不顯示 | 聯絡信箱 |
| `COMPANY_PHONE` | 不顯示 | 聯絡電話 |
| `BANK_NAME` / `BANK_ACCOUNT_NAME` / `BANK_ACCOUNT_NUMBER` | 整區隱藏 | 匯款資訊區塊(三者皆空時隱藏) |
| `RESEND_API_KEY` | 寄信停用 | Resend API 金鑰;未設定時「寄送報價單」按鈕停用 |
| `MAIL_SENDER_NAME` | 同 `COMPANY_NAME` | 寄件人顯示名稱 |
| `MAIL_SENDER_EMAIL` | `onboarding@resend.dev` | 寄件地址(需在 Resend 完成網域驗證) |
| `MAIL_CC_EMAILS` | 不 CC | 逗號分隔的 CC 名單 |
| `CURRENCY` | `TWD` | ISO 4217 幣別代碼 |
| `CURRENCY_LOCALE` | `zh-TW` | 金額格式使用的 Intl locale(與介面語言無關) |
| `DEFAULT_TAX_RATE` | `5` | 新報價單預設稅率(%) |

### 品牌圖檔

在專案根目錄建立 `branding/` 目錄放 PNG(已被 gitignore,你的圖檔不會進版控):

| 檔案 | Fallback | 用途 |
|---|---|---|
| `branding/logo.png` | 中性預設 logo | 報價頁、PDF、Email 頁首 |
| `branding/stamp.png` | 區塊省略 | PDF 簽名區的公司大小章 |
| `branding/icon.png` | `logo.png` → 預設 logo | 瀏覽器 favicon(由 `/api/branding-icon` 提供) |

## 部署(Docker)

`docker compose up -d` 會建置並啟動完整服務(app + PostgreSQL),`.env` 與 `branding/` 於執行期注入:

```yaml
# docker-compose.yaml 已內建
env_file: [.env]
volumes:
  - ./branding:/app/branding
```

或直接跑建好的 image:

```bash
docker run -d --name quote-system -p 3000:3000 \
  --env-file /path/to/.env \
  -v /path/to/branding:/app/branding \
  ghcr.io/sychen6192/quote-system:latest
```

首次部署對資料庫執行一次 `npm run db:push` 建表。

> `.github/workflows/deploy.yml` 是原作者個人 homelab 的部署流程,已用 `repository_owner` 條件保護 — fork 不會觸發。

## 資安須知

**本系統沒有登入驗證**,設計給信任環境(公司內網、私人 homelab)使用。若要對外公開,請在前面加一層帶驗證的反向代理(Cloudflare Access、Authelia、oauth2-proxy 等)。歡迎貢獻內建驗證功能 — 見 Roadmap。

## 專案結構

```
quote-system/
├── actions/            # Server Actions(建立/更新報價、寄信)
├── app/                # Next.js App Router 頁面 + API routes
├── branding-defaults/  # 進版控的預設品牌圖檔(fallback)
├── components/         # React 元件(ui/、quotes/、pdf/、emails/、providers/)
├── db/                 # Drizzle schema 與 client
├── lib/                # 設定載入器、Zod schema、金額工具
├── messages/           # 多語系字串(en、zh-TW)
├── services/           # 讀取端查詢服務
└── tests/              # Jest 單元測試
```

### 常用指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器 |
| `npm run build` / `npm start` | 正式建置 / 啟動 |
| `npm test` | 執行 Jest 測試 |
| `npm run lint` | ESLint |
| `npm run db:push` | 將 Drizzle schema 推送到資料庫 |
| `npm run db:studio` | Drizzle Studio(資料庫瀏覽器) |

## Roadmap

歡迎 PR 的方向:

- 內建登入驗證/使用者管理
- 設定管理介面(在系統內編輯公司資訊,取代環境變數)
- 多幣別報價
- 更多語言

## 貢獻

1. Fork 後開 feature branch
2. `npm test && npm run lint` 必須通過;CI 也會跑完整 build
3. 發 Pull Request

## 授權

[MIT](LICENSE) © 2026 Jack SY Chen
