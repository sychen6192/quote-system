# 開源白牌化重構設計(Open-Source White-Label Refactor)

**日期**: 2026-07-19
**專案**: quote-system(報價管理系統)
**目標**: 將本專案重構為可開源、任一公司填入自己的資料即可使用的白牌系統,同時本 repo 繼續作為作者自用的部署來源(同 repo 兩用)。

---

## 已確認決策

| 決策點 | 結論 |
|---|---|
| 開源程度 | 可設定白牌版:公司資料、品牌、幣別、預設稅率集中設定 |
| Repo 定位 | 同一個 repo 直接轉公開;作者真實設定留在本機 gitignore 檔案 |
| 授權 | MIT(copyright 2026 Jack SY Chen) |
| 文件語言 | 英文為主(README.md),另附繁中完整版(README.zh-TW.md) |
| 設定機制 | Runtime 注入:環境變數(文字)+ `branding/` 圖檔(圖片),全部有預設值 |

## 背景與現況問題

1. **Clone 即編譯失敗**:`lib/company-info.ts` 被 gitignore(含公司名、地址、統編、電話、Email、銀行帳號、logo 與公司大小章 base64),但 4 個檔案直接 import 它。
2. **CI 部署實際上是壞的**:`.github/workflows/deploy.yml` 從 GitHub checkout 建置 image,checkout 裡沒有 gitignore 的 `company-info.ts` 與 `.env`,`npm run build` 必然失敗。只有 runtime 注入設定,同一個公開 image 才能同時服務作者與任何公司。
3. **公司資訊散落硬編碼**:`messages/zh-TW.json` 與 `messages/en.json` 的網站標題、`actions/send-email.tsx:45` 信件主旨("from Shangda Inc.")。
4. **幣別/稅率硬編碼**:`Intl.NumberFormat(..., currency: "TWD")` 重複出現在 6 個檔案;預設稅率 `5` 寫死在 `components/quote-form.tsx:53`。
5. **缺開源基本件**:無 LICENSE、無 `.env.example`、README 中英夾雜且與 docker-compose 的 DB 名稱不一致。
6. **公司品牌圖示**:`public/` 下的 favicon 與 android-chrome PNG 是公司 logo。
7. **未使用依賴**:`nodemailer`、`@types/nodemailer`(寄信只用 Resend)。
8. Git 歷史乾淨:`company-info.ts` 與 `.env` 從未被 commit,**不需要改寫 git 歷史**。

## 架構設計

### 1. `lib/config.ts` — 設定單一來源(僅 server 端)

```ts
export type AppConfig = {
  company: {
    name: string;        // COMPANY_NAME,預設 "Your Company"
    isDefault: boolean;  // COMPANY_NAME 未設定時為 true(供 metadata 判斷)
    nameLocal: string;   // 空字串 = 不顯示該行
    address: string;
    vatNumber: string;
    email: string;
    phone: string;
  };
  payment: {             // 三個欄位全空 → 整個 payment 為 null → 隱藏付款區塊
    bankName: string;    // 部分填寫時 payment 非 null,個別空欄位的那一行不渲染
    accountName: string;
    accountNumber: string;
  } | null;
  mail: {
    enabled: boolean;    // = Boolean(RESEND_API_KEY)
    senderName: string;
    senderEmail: string;
    ccEmails: string[];
  };
  money: {
    currency: string;        // ISO 4217
    currencyLocale: string;  // Intl locale(金額格式專用,與 UI 語言無關)
    defaultTaxRate: number;  // %
  };
};

export function getAppConfig(): AppConfig;
export function getBrandingDataUri(kind: "logo" | "stamp"): string | null;
export type PublicAppConfig = {
  companyName: string;
  currency: string;
  currencyLocale: string;
  defaultTaxRate: number;
};
export function toPublicConfig(c: AppConfig): PublicAppConfig;
```

實作規則:
- 模組使用 `node:fs` / `node:path`,天然無法進 client bundle;不新增 `server-only` 依賴。
- `DEFAULT_TAX_RATE` 以 `Number()` 解析,NaN 或超出 0–100 時回退 5。
- `MAIL_CC_EMAILS` 以逗號分隔:`split(",").map(trim).filter(Boolean)`。
- 所有讀取皆在函式呼叫時進行,不做模組層快取(呼叫頻率低,簡單優先)。

### 2. 環境變數一覽(committed 至 `.env.example`)

| 變數 | 未設定時的行為 | 說明 |
|---|---|---|
| `COMPANY_NAME` | `"Your Company"`,`isDefault=true` | 公司主要名稱 |
| `COMPANY_NAME_LOCAL` | 空 → 不顯示 | 本地語言名稱(如中文) |
| `COMPANY_ADDRESS` | 空 → 不顯示 | 地址 |
| `COMPANY_VAT_NUMBER` | 空 → 不顯示 | 統一編號/稅號 |
| `COMPANY_EMAIL` | 空 → 不顯示 | 聯絡信箱 |
| `COMPANY_PHONE` | 空 → 不顯示 | 電話 |
| `BANK_NAME` | 空 | 銀行名稱 |
| `BANK_ACCOUNT_NAME` | 空 | 戶名 |
| `BANK_ACCOUNT_NUMBER` | 空 | 帳號(三者全空 → 付款區塊隱藏) |
| `MAIL_SENDER_NAME` | 取 `COMPANY_NAME` 的值 | 寄件人顯示名 |
| `MAIL_SENDER_EMAIL` | `"onboarding@resend.dev"` | 寄件地址(Resend 測試域) |
| `MAIL_CC_EMAILS` | 空 → 不 CC | 逗號分隔 |
| `RESEND_API_KEY` | 未設 → `mail.enabled=false`,寄信按鈕停用 | Resend 金鑰 |
| `CURRENCY` | `"TWD"` | 幣別代碼 |
| `CURRENCY_LOCALE` | `"zh-TW"` | 金額格式 locale |
| `DEFAULT_TAX_RATE` | `"5"` | 新報價單預設稅率(%) |
| `DATABASE_URL` | (必填,無預設) | PostgreSQL 連線字串 |

### 3. 品牌圖檔(`branding/`)

| 檔案 | Fallback 順序 | 用途 |
|---|---|---|
| `branding/logo.png` | → `branding/defaults/logo.png`(committed 中性圖) | 報價頁、PDF、Email 的 logo |
| `branding/stamp.png` | → 無;`null` 時 PDF 蓋章區塊不渲染 | 公司大小章 |
| `branding/icon.png` | → `logo.png` → `defaults/logo.png` | 網站 favicon |

- `.gitignore`:移除 `*company-info.ts` 規則;新增 `branding/*` 與 `!branding/defaults/`。
- 讀取一律 `path.join(process.cwd(), "branding", ...)`,`try/catch` 包覆,只支援 PNG。
- Favicon 走 runtime route `app/api/branding-icon/route.ts`(GET 回傳 PNG,`Cache-Control: public, max-age=3600`),`generateMetadata` 設 `icons: [{ url: "/api/branding-icon", type: "image/png" }]`。現有 middleware matcher(`proxy.ts`)只攔 `/` 與 locale 路徑,不會攔到 `/api/*`,無需調整。
- 刪除 `public/` 下 6 個公司圖示檔(favicon.ico、favicon-16x16.png、favicon-32x32.png、apple-touch-icon.png、android-chrome-192x192.png、android-chrome-512x512.png)與 `site.webmanifest`。

### 4. Client 端注入

- 新增 `components/providers/app-config-provider.tsx`("use client",React context)。
- `app/[locale]/layout.tsx`(server)呼叫 `getAppConfig()` → `toPublicConfig()`,把 **client-safe 子集**傳入 provider。銀行帳號、信箱設定等敏感值不進 client bundle。
- Hooks:`useAppConfig(): PublicAppConfig`、`useFormatCurrency(): (cents: number) => string`。

### 5. 金額格式化集中

- `lib/utils.ts`:`formatCurrency(cents: number, opts: { currency: string; locale: string }): string`;`Intl.NumberFormat` 失敗(無效幣別代碼)時 fallback 為 `` `${currency} ${Math.round(cents / 100)}` `` 並 `console.warn`。
- 刪除 6 處重複的 inline `Intl.NumberFormat`。
- Server 元件:`getAppConfig()` 後傳參。Client 元件:`useFormatCurrency()`。
- PDF 與 Email 元件維持 pure:以 props 接收 config,不自行讀 env。

### 6. Build 不依賴資料庫與環境

- 目標:`npm run build` 在**無 DB、無 .env、無 branding/** 下成功(CI 與 Docker build 的前提)。
- `app/[locale]/page.tsx` 已有 `export const dynamic = "force-dynamic"`;實作時逐一確認其餘讀 DB 的頁面(quotes 列表、`[id]` 詳細頁、`new`/`edit` 表單頁)在 build 期不執行查詢,必要時補上 `force-dynamic`。
- `db/index.ts` 的 postgres client 為 lazy connect,import 不觸發連線,維持現狀。

## 檔案層級變更清單

### 新增
| 檔案 | 內容 |
|---|---|
| `lib/config.ts` | 設定單一來源(如上) |
| `components/providers/app-config-provider.tsx` | Context + `useAppConfig` + `useFormatCurrency` |
| `app/api/branding-icon/route.ts` | Runtime favicon |
| `branding/defaults/logo.png` | 中性預設 logo(簡單幾何圖形,非任何公司品牌) |
| `.env.example` | 全部環境變數附註解 |
| `LICENSE` | MIT |
| `README.md` | 英文重寫(見「文件」節) |
| `README.zh-TW.md` | 繁中完整版 |
| `.github/workflows/ci.yml` | push/PR:`npm ci` → lint → test → build(Node 22,無 DB) |
| `tests/unit/lib/config.test.ts` | 設定載入器單元測試 |
| `tests/unit/lib/utils.test.ts` | `formatCurrency` 新簽名與 fallback 測試 |

### 修改
| 檔案 | 變更 |
|---|---|
| `app/[locale]/layout.tsx` | 讀 config、包 provider、metadata title 規則、favicon icons |
| `app/[locale]/quotes/[id]/page.tsx` | 改用 `getAppConfig()`;company 各欄位空值不渲染;payment 為 null 時隱藏付款卡;`Currency` 欄顯示 `config.money.currency`;傳 `mailEnabled` 給寄信按鈕 |
| `app/[locale]/quotes/[id]/pdf/route.tsx` | 組 config props 傳入 `QuotePDFDocument` |
| `components/pdf/QuotePDFDocument.tsx` | 移除 company-info import,改收 props(company、logoDataUri、stampDataUri、payment、money);stamp/payment 條件渲染 |
| `components/emails/quote-template.tsx` | 同上(company、payment、money props;條件渲染) |
| `actions/send-email.tsx` | `getAppConfig()`:未設 API key 直接回傳「未設定」錯誤;from/cc/subject 用 config;傳 props 給 Email 與 PDF 元件 |
| `components/send-email-button.tsx` | 新增 `disabled`(mail 未設定)prop 與提示文字 |
| `components/quote-form.tsx` | 預設稅率改 `useAppConfig().defaultTaxRate`;4 處 inline 格式化改 `useFormatCurrency()` |
| `app/[locale]/page.tsx`、`components/quotes/quotes-table.tsx`、`components/dashboard/recent-quotes-table.tsx` | `formatCurrency` 改新簽名(server 傳參 / client 用 hook,依元件類型) |
| `lib/utils.ts` | `formatCurrency` 新簽名 + fallback |
| `messages/en.json` / `messages/zh-TW.json` | `Metadata.title` 改通用(`"Quote System"` / `"報價系統"`);公司名由 metadata 動態組合:`isDefault ? title : \`${name} | ${title}\`` |
| `.github/workflows/deploy.yml` | 兩個 job 皆加 `if: github.repository_owner == 'sychen6192'`;image 改 `ghcr.io/${{ github.repository }}:latest`;`docker run` 加 `--env-file $HOME/quote-system/.env` 與 `-v $HOME/quote-system/branding:/app/branding`(runner 主機上的固定路徑,README 部署節說明) |
| `docker-compose.yaml` | app service 加 `env_file: .env` 與 `volumes: ./branding:/app/branding`;postgres service 維持不動(避免影響作者既有資料) |
| `Dockerfile` | `COPY branding/defaults ./branding/defaults`(確保 standalone 有 fallback 圖) |
| `.gitignore` | 移除 `*company-info.ts`;新增 `branding/*`、`!branding/defaults/` |
| `package.json` | 移除未使用的 `nodemailer`、`@types/nodemailer` |

### 刪除
- `lib/company-info.ts` 的**依賴**(檔案本身在作者本機保留至遷移完成後手動刪除,repo 無此檔)
- `public/` 6 個公司圖示 + `site.webmanifest`

## 錯誤處理

| 情境 | 行為 |
|---|---|
| 公司/品牌/郵件/金額類環境變數缺失 | 一律採預設值,**不 throw**;`DATABASE_URL` 是唯一例外 — config loader 不碰它,但任何 DB 頁面在 runtime 需要它(Quickstart 第一步即建立) |
| branding 圖檔缺失 | logo → 預設圖;stamp → 區塊不渲染;icon → 沿 fallback 鏈 |
| `RESEND_API_KEY` 未設 | UI 按鈕 disabled + 提示;server action 防禦性回傳 error(不依賴 UI) |
| 無效 `CURRENCY` | `formatCurrency` fallback 純文字格式 + `console.warn` |
| 無效 `DEFAULT_TAX_RATE` | 回退 5 |

## 測試策略

1. **單元測試(新增)**:
   - `tests/unit/lib/config.test.ts`:無任何 env → 全預設值、`payment === null`、`mail.enabled === false`、`isDefault === true`;設定完整 env → 正確映射;`MAIL_CC_EMAILS` 逗號解析(含空白、尾逗號);`DEFAULT_TAX_RATE` 非數字/越界 → 回退 5
   - `tests/unit/lib/utils.test.ts`:`formatCurrency` 新簽名 TWD/USD 正常、無效代碼 fallback
2. **既有測試**:`tests/unit/actions/*` 維持通過(create/update quote 不受影響)。
3. **CI**:`ci.yml` 每次 push/PR 執行 lint + test + build,「clone 就能 build」從此有迴歸防護。
4. **手動驗收**:見驗收標準。

## 文件

- **README.md(英文)**:專案介紹與功能、零設定 Quickstart(`git clone` → `npm install` → `docker compose up -d` → `npm run db:push` → `npm run dev`)、設定表(環境變數 + branding 圖檔)、Docker 部署(含 `--env-file` 與 branding volume 範例)、**Security 節:本系統無登入驗證,設計用於內網/信任環境,公開部署請自行加反向代理驗證**、Contributing 小節、License。
- **README.zh-TW.md**:同結構繁中版,兩檔互連。
- README 內 `DATABASE_URL` 範例與 docker-compose 對齊:`postgres://postgres:postgres@localhost:5432/quote-system`。

## 作者資料無縫遷移(僅本機,不進 git)

1. 讀取現有 `lib/company-info.ts` 的值,**append** 到 `.env`(保留既有 `DATABASE_URL`、`RESEND_API_KEY` 不動)。
2. `logoBase64` / `stampBase64` 解碼寫入 `branding/logo.png`、`branding/stamp.png`;`android-chrome-512x512.png` 複製為 `branding/icon.png`(須在刪除 `public/` 圖示之前執行)。
3. 驗證(帶真實設定跑 dev + PDF)後,本機刪除 `lib/company-info.ts`。
4. Homelab 部署主機:放置 `.env` 與 `branding/`,對應 `deploy.yml` 的 `--env-file` 與 volume 路徑。

## 驗收標準

1. **乾淨 clone 模擬**,分兩段驗證:
   - **Build 段**(完全無 `.env`、無 `branding/` 使用者圖檔):`npm ci && npm run lint && npm test && npm run build` 全部成功。
   - **Dev 段**(模擬新使用者照 README 走:`.env` 僅含 `DATABASE_URL`,compose 起 DB、`db:push`):首頁、新增報價、詳細頁正常,顯示 "Your Company" 與預設 logo,付款區塊隱藏,寄信按鈕 disabled。
2. **作者設定還原後**:詳細頁、PDF、Email 預覽與重構前一致(公司名、logo、大小章、銀行資訊)。
3. **無公司資料殘留**:tracked files 中 grep `聖大|Shangda|Shanda|sycomputer|teching|qazxsw|50990180|369-54040269|931 330` → 0 筆(`deploy.yml` 的 `repository_owner == 'sychen6192'` 為公開 GitHub 帳號名,允許)。
4. **敏感值不進前端**:build 後 `grep -r "BANK_ACCOUNT\|senderEmail" .next/static` → 0 筆。
5. **開源基本件到位**:LICENSE、README.md、README.zh-TW.md、`.env.example` 存在且內容一致。
6. Fork 本 repo 的人:CI(lint/test/build)會跑,homelab 部署 job 因 owner 條件不觸發。

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| Next standalone 模式下 `process.cwd()` 讀不到 `branding/` | Dockerfile COPY defaults;驗收時以 `node .next/standalone/server.js` 實測 |
| `@react-pdf` 對條件渲染/缺圖的相容性 | stamp 為 null 時整個 `<Image>` 不渲染(非傳空 src) |
| 敏感 config 意外進入 client bundle | 只有 `PublicAppConfig` 穿越 server/client 邊界;驗收標準第 4 條以 grep 驗證 |
| 作者本機/homelab 部署中斷 | 遷移步驟先行、驗證後才刪本機檔;compose 的 postgres service 完全不動 |
| build 期意外執行 DB 查詢 | 逐頁確認 dynamic 標記;驗收標準第 1 條在無 DB 環境驗證 build |

## 明確不做(YAGNI)

- 登入驗證/權限(README 註明限信任環境 + roadmap)
- 設定管理頁(DB-backed settings UI)
- 多幣別並存(單一幣別設定已滿足「任一公司」)
- Email provider 抽象層(僅 Resend)
- 新增 UI 語言(維持 en / zh-TW)
- Git 歷史改寫(歷史本來就乾淨)
