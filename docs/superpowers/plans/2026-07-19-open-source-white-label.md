# Open-Source White-Label Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 quote-system 重構為任一公司可用的開源白牌系統:公司資料/品牌/幣別/稅率全部 runtime 注入(env + `branding/` 圖檔,皆有預設值),補齊 LICENSE/README/CI,並讓作者本機與 homelab 部署無縫遷移。

**Architecture:** 新增 server-only 的 `lib/config.ts` 作為設定單一來源(env → typed config,圖檔 → data URI,含 fallback);client 端經 `AppConfigProvider` 只拿 client-safe 子集;PDF/Email 元件改為 pure(props 收 `QuoteBranding`)。Build 完全不依賴 DB 與 env。

**Tech Stack:** Next.js 16 App Router、TypeScript strict、Drizzle、next-intl、@react-pdf/renderer、react-email、Resend、Jest(ts-jest, node env)。

**Spec:** `docs/superpowers/specs/2026-07-19-open-source-refactor-design.md`

## Global Constraints

- 金額一律以「分」(cents) 儲存與計算;稅率以 basis points(1% = 100 BP)。
- 不新增任何 runtime 依賴;移除未使用的 `nodemailer`、`@types/nodemailer`。
- 所有新 UI 字串必須同時加入 `messages/en.json` 與 `messages/zh-TW.json`。
- 敏感設定(銀行、信箱、API key)絕不可進 client bundle;client 只能拿 `PublicAppConfig`。
- 環境變數缺失一律用預設值,不 throw(`DATABASE_URL` 除外,config loader 不碰它)。
- 每個 task 結束時 `npx tsc --noEmit` 與 `npm test` 必須通過(build 驗證放 Task 8/10)。
- Commit message 結尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 圖檔讀取一律 `path.join(process.cwd(), ...)`;預設圖在 committed 的 `branding-defaults/`,使用者圖在 gitignored 的 `branding/`(volume 掛載點)。

---

### Task 1: `lib/config.ts` 設定載入器(TDD)

**Files:**
- Create: `lib/config.ts`
- Test: `tests/unit/lib/config.test.ts`

**Interfaces (Produces):**
```ts
export type AppConfig = {
  company: { name: string; isDefault: boolean; nameLocal: string; address: string; vatNumber: string; email: string; phone: string };
  payment: { bankName: string; accountName: string; accountNumber: string } | null;
  mail: { enabled: boolean; senderName: string; senderEmail: string; ccEmails: string[] };
  money: { currency: string; currencyLocale: string; defaultTaxRate: number };
};
export type PublicAppConfig = { companyName: string; currency: string; currencyLocale: string; defaultTaxRate: number };
export type QuoteBranding = {
  company: AppConfig["company"];
  logoDataUri: string;            // 一定有值(fallback 到預設圖)
  stampDataUri: string | null;    // 無檔案時 null
  payment: AppConfig["payment"];
  money: AppConfig["money"];
};
export function getAppConfig(env?: NodeJS.ProcessEnv): AppConfig;
export function toPublicConfig(config: AppConfig): PublicAppConfig;
export function getBrandingDataUri(kind: "logo" | "stamp" | "icon", baseDir?: string): string | null;
export function getBrandingFile(kind: "logo" | "stamp" | "icon", baseDir?: string): Buffer | null;
export function getQuoteBranding(): QuoteBranding;
```

- [ ] **Step 1: 寫失敗測試 `tests/unit/lib/config.test.ts`**

```ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  getAppConfig,
  toPublicConfig,
  getBrandingDataUri,
} from "@/lib/config";

// 1x1 transparent PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

describe("getAppConfig", () => {
  it("returns placeholder defaults when no env vars are set", () => {
    const config = getAppConfig({} as NodeJS.ProcessEnv);
    expect(config.company.name).toBe("Your Company");
    expect(config.company.isDefault).toBe(true);
    expect(config.company.nameLocal).toBe("");
    expect(config.company.address).toBe("");
    expect(config.company.vatNumber).toBe("");
    expect(config.company.email).toBe("");
    expect(config.company.phone).toBe("");
    expect(config.payment).toBeNull();
    expect(config.mail.enabled).toBe(false);
    expect(config.mail.senderName).toBe("Your Company");
    expect(config.mail.senderEmail).toBe("onboarding@resend.dev");
    expect(config.mail.ccEmails).toEqual([]);
    expect(config.money).toEqual({
      currency: "TWD",
      currencyLocale: "zh-TW",
      defaultTaxRate: 5,
    });
  });

  it("maps all env vars when set", () => {
    const config = getAppConfig({
      COMPANY_NAME: "Acme Ltd.",
      COMPANY_NAME_LOCAL: "頂尖有限公司",
      COMPANY_ADDRESS: "1 Main St",
      COMPANY_VAT_NUMBER: "12345678",
      COMPANY_EMAIL: "hi@acme.test",
      COMPANY_PHONE: "+886 900 000 000",
      BANK_NAME: "Bank",
      BANK_ACCOUNT_NAME: "Acme",
      BANK_ACCOUNT_NUMBER: "000-111",
      MAIL_SENDER_NAME: "Acme Billing",
      MAIL_SENDER_EMAIL: "billing@acme.test",
      MAIL_CC_EMAILS: " a@x.test, b@y.test ,,",
      RESEND_API_KEY: "re_test",
      CURRENCY: "USD",
      CURRENCY_LOCALE: "en-US",
      DEFAULT_TAX_RATE: "8.25",
    } as NodeJS.ProcessEnv);
    expect(config.company.name).toBe("Acme Ltd.");
    expect(config.company.isDefault).toBe(false);
    expect(config.payment).toEqual({
      bankName: "Bank",
      accountName: "Acme",
      accountNumber: "000-111",
    });
    expect(config.mail.enabled).toBe(true);
    expect(config.mail.senderName).toBe("Acme Billing");
    expect(config.mail.ccEmails).toEqual(["a@x.test", "b@y.test"]);
    expect(config.money).toEqual({
      currency: "USD",
      currencyLocale: "en-US",
      defaultTaxRate: 8.25,
    });
  });

  it("keeps payment non-null when only some bank fields are set", () => {
    const config = getAppConfig({ BANK_NAME: "Bank" } as NodeJS.ProcessEnv);
    expect(config.payment).toEqual({
      bankName: "Bank",
      accountName: "",
      accountNumber: "",
    });
  });

  it("falls back MAIL_SENDER_NAME to company name", () => {
    const config = getAppConfig({
      COMPANY_NAME: "Acme Ltd.",
    } as NodeJS.ProcessEnv);
    expect(config.mail.senderName).toBe("Acme Ltd.");
  });

  it.each([["abc"], ["-1"], ["101"], [""]])(
    "falls back DEFAULT_TAX_RATE to 5 for invalid value %p",
    (value) => {
      const config = getAppConfig({
        DEFAULT_TAX_RATE: value,
      } as NodeJS.ProcessEnv);
      expect(config.money.defaultTaxRate).toBe(5);
    }
  );
});

describe("toPublicConfig", () => {
  it("exposes only client-safe fields", () => {
    const pub = toPublicConfig(
      getAppConfig({
        COMPANY_NAME: "Acme Ltd.",
        BANK_ACCOUNT_NUMBER: "secret-999",
      } as NodeJS.ProcessEnv)
    );
    expect(pub).toEqual({
      companyName: "Acme Ltd.",
      currency: "TWD",
      currencyLocale: "zh-TW",
      defaultTaxRate: 5,
    });
    expect(JSON.stringify(pub)).not.toContain("secret-999");
  });
});

describe("getBrandingDataUri", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "branding-test-"));
    fs.mkdirSync(path.join(dir, "branding"));
    fs.mkdirSync(path.join(dir, "branding-defaults"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("prefers user logo over default", () => {
    fs.writeFileSync(path.join(dir, "branding", "logo.png"), TINY_PNG);
    fs.writeFileSync(
      path.join(dir, "branding-defaults", "logo.png"),
      Buffer.from("not-used")
    );
    expect(getBrandingDataUri("logo", dir)).toBe(
      `data:image/png;base64,${TINY_PNG.toString("base64")}`
    );
  });

  it("falls back logo to branding-defaults", () => {
    fs.writeFileSync(path.join(dir, "branding-defaults", "logo.png"), TINY_PNG);
    expect(getBrandingDataUri("logo", dir)).toBe(
      `data:image/png;base64,${TINY_PNG.toString("base64")}`
    );
  });

  it("returns null for missing stamp (no default)", () => {
    expect(getBrandingDataUri("stamp", dir)).toBeNull();
  });

  it("falls back icon to logo then default logo", () => {
    fs.writeFileSync(path.join(dir, "branding-defaults", "logo.png"), TINY_PNG);
    expect(getBrandingDataUri("icon", dir)).toBe(
      `data:image/png;base64,${TINY_PNG.toString("base64")}`
    );
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — `npm test -- tests/unit/lib/config.test.ts`,預期 FAIL(Cannot find module '@/lib/config')。

- [ ] **Step 3: 實作 `lib/config.ts`**

```ts
import * as fs from "node:fs";
import * as path from "node:path";

export type AppConfig = {
  company: {
    name: string;
    isDefault: boolean;
    nameLocal: string;
    address: string;
    vatNumber: string;
    email: string;
    phone: string;
  };
  payment: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  } | null;
  mail: {
    enabled: boolean;
    senderName: string;
    senderEmail: string;
    ccEmails: string[];
  };
  money: {
    currency: string;
    currencyLocale: string;
    defaultTaxRate: number;
  };
};

export type PublicAppConfig = {
  companyName: string;
  currency: string;
  currencyLocale: string;
  defaultTaxRate: number;
};

export type QuoteBranding = {
  company: AppConfig["company"];
  logoDataUri: string;
  stampDataUri: string | null;
  payment: AppConfig["payment"];
  money: AppConfig["money"];
};

const DEFAULT_COMPANY_NAME = "Your Company";
const DEFAULT_SENDER_EMAIL = "onboarding@resend.dev";
const DEFAULT_TAX_RATE = 5;

function parseTaxRate(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_TAX_RATE;
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0 || value > 100) return DEFAULT_TAX_RATE;
  return value;
}

export function getAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const name = env.COMPANY_NAME?.trim() || DEFAULT_COMPANY_NAME;
  const isDefault = !env.COMPANY_NAME?.trim();

  const bankName = env.BANK_NAME?.trim() ?? "";
  const accountName = env.BANK_ACCOUNT_NAME?.trim() ?? "";
  const accountNumber = env.BANK_ACCOUNT_NUMBER?.trim() ?? "";
  const payment =
    bankName || accountName || accountNumber
      ? { bankName, accountName, accountNumber }
      : null;

  const ccEmails = (env.MAIL_CC_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    company: {
      name,
      isDefault,
      nameLocal: env.COMPANY_NAME_LOCAL?.trim() ?? "",
      address: env.COMPANY_ADDRESS?.trim() ?? "",
      vatNumber: env.COMPANY_VAT_NUMBER?.trim() ?? "",
      email: env.COMPANY_EMAIL?.trim() ?? "",
      phone: env.COMPANY_PHONE?.trim() ?? "",
    },
    payment,
    mail: {
      enabled: Boolean(env.RESEND_API_KEY),
      senderName: env.MAIL_SENDER_NAME?.trim() || name,
      senderEmail: env.MAIL_SENDER_EMAIL?.trim() || DEFAULT_SENDER_EMAIL,
      ccEmails,
    },
    money: {
      currency: env.CURRENCY?.trim() || "TWD",
      currencyLocale: env.CURRENCY_LOCALE?.trim() || "zh-TW",
      defaultTaxRate: parseTaxRate(env.DEFAULT_TAX_RATE),
    },
  };
}

export function toPublicConfig(config: AppConfig): PublicAppConfig {
  return {
    companyName: config.company.name,
    currency: config.money.currency,
    currencyLocale: config.money.currencyLocale,
    defaultTaxRate: config.money.defaultTaxRate,
  };
}

type BrandingKind = "logo" | "stamp" | "icon";

function brandingCandidates(kind: BrandingKind, baseDir: string): string[] {
  const user = (file: string) => path.join(baseDir, "branding", file);
  const fallback = (file: string) => path.join(baseDir, "branding-defaults", file);
  switch (kind) {
    case "logo":
      return [user("logo.png"), fallback("logo.png")];
    case "stamp":
      return [user("stamp.png")];
    case "icon":
      return [user("icon.png"), user("logo.png"), fallback("logo.png")];
  }
}

export function getBrandingFile(
  kind: BrandingKind,
  baseDir: string = process.cwd()
): Buffer | null {
  for (const candidate of brandingCandidates(kind, baseDir)) {
    try {
      return fs.readFileSync(candidate);
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function getBrandingDataUri(
  kind: BrandingKind,
  baseDir: string = process.cwd()
): string | null {
  const file = getBrandingFile(kind, baseDir);
  if (!file) return null;
  return `data:image/png;base64,${file.toString("base64")}`;
}

export function getQuoteBranding(): QuoteBranding {
  const config = getAppConfig();
  return {
    company: config.company,
    // logo 永遠有值:branding-defaults/logo.png 是 committed 檔案
    logoDataUri: getBrandingDataUri("logo") ?? "",
    stampDataUri: getBrandingDataUri("stamp"),
    payment: config.payment,
    money: config.money,
  };
}
```

- [ ] **Step 4: 跑測試確認通過** — `npm test -- tests/unit/lib/config.test.ts`,預期全部 PASS。
- [ ] **Step 5: `npx tsc --noEmit` 通過後 commit** — `git add lib/config.ts tests/unit/lib/config.test.ts && git commit -m "feat(config): add runtime app config loader with branding fallbacks"`

---

### Task 2: `formatCurrency` 新簽名 + 三個 server 呼叫端(TDD)

**Files:**
- Modify: `lib/utils.ts:8-14`
- Test: `tests/unit/lib/utils.test.ts`(新增)
- Modify: `app/[locale]/page.tsx:1,43`
- Modify: `components/quotes/quotes-table.tsx:13-17,112`
- Modify: `components/dashboard/recent-quotes-table.tsx:14,80`

**Interfaces:**
- Consumes: `getAppConfig()`(Task 1)。
- Produces: `formatCurrency(cents: number, money: { currency: string; currencyLocale: string }): string` — 之後所有任務都用這個簽名。

- [ ] **Step 1: 寫失敗測試 `tests/unit/lib/utils.test.ts`**

```ts
import { formatCurrency } from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats TWD in zh-TW with no decimals from cents", () => {
    expect(
      formatCurrency(123456, { currency: "TWD", currencyLocale: "zh-TW" })
    ).toBe("$1,235");
  });

  it("formats USD in en-US", () => {
    expect(
      formatCurrency(123456, { currency: "USD", currencyLocale: "en-US" })
    ).toBe("$1,235");
  });

  it("falls back to plain text for invalid currency code", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      formatCurrency(200000, { currency: "NOPE!", currencyLocale: "zh-TW" })
    ).toBe("NOPE! 2000");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — `npm test -- tests/unit/lib/utils.test.ts`,預期 FAIL(參數個數/輸出不符)。
- [ ] **Step 3: 改 `lib/utils.ts` 的 `formatCurrency`**

```ts
export function formatCurrency(
  cents: number,
  money: { currency: string; currencyLocale: string }
) {
  try {
    return new Intl.NumberFormat(money.currencyLocale, {
      style: "currency",
      currency: money.currency,
      maximumFractionDigits: 0,
    }).format(cents / 100); // 輸入是分 (Cents)
  } catch (error) {
    console.warn("formatCurrency: invalid currency config", money, error);
    return `${money.currency} ${Math.round(cents / 100)}`;
  }
}
```

- [ ] **Step 4: 更新三個 server 呼叫端**(皆為 async server component,直接讀 config)
  - `app/[locale]/page.tsx`:import 加 `import { getAppConfig } from "@/lib/config";`,function 內加 `const { money } = getAppConfig();`,`formatCurrency(metrics.totalRevenue)` → `formatCurrency(metrics.totalRevenue, money)`。
  - `components/quotes/quotes-table.tsx`:同樣加 import 與 `const { money } = getAppConfig();`(放在 `const format = await getFormatter();` 之後),`formatCurrency(quote.totalAmount)` → `formatCurrency(quote.totalAmount, money)`。
  - `components/dashboard/recent-quotes-table.tsx`:同上,`formatCurrency(q.totalAmount)` → `formatCurrency(q.totalAmount, money)`。
- [ ] **Step 5: 驗證後 commit** — `npm test && npx tsc --noEmit`;`git add -A && git commit -m "refactor(money): formatCurrency takes currency config instead of hardcoded TWD"`

---

### Task 3: Client 設定注入 + Metadata 白牌化

**Files:**
- Create: `components/providers/app-config-provider.tsx`
- Modify: `app/[locale]/layout.tsx`
- Modify: `messages/en.json:3`、`messages/zh-TW.json:3`

**Interfaces:**
- Consumes: `getAppConfig`、`toPublicConfig`、`PublicAppConfig`(Task 1)、`formatCurrency`(Task 2)。
- Produces: `<AppConfigProvider value={PublicAppConfig}>`、`useAppConfig(): PublicAppConfig`、`useFormatCurrency(): (cents: number) => string`。

- [ ] **Step 1: 建 `components/providers/app-config-provider.tsx`**

```tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicAppConfig } from "@/lib/config";
import { formatCurrency } from "@/lib/utils";

const AppConfigContext = createContext<PublicAppConfig | null>(null);

export function AppConfigProvider({
  value,
  children,
}: {
  value: PublicAppConfig;
  children: ReactNode;
}) {
  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig(): PublicAppConfig {
  const config = useContext(AppConfigContext);
  if (!config) {
    throw new Error("useAppConfig must be used within <AppConfigProvider>");
  }
  return config;
}

export function useFormatCurrency(): (cents: number) => string {
  const { currency, currencyLocale } = useAppConfig();
  return (cents: number) => formatCurrency(cents, { currency, currencyLocale });
}
```

(註:`lib/config.ts` 有 `node:fs` import,client 檔案只 `import type`,不會把 fs 拉進 bundle。)

- [ ] **Step 2: 改 `app/[locale]/layout.tsx`**
  - 加 import:`import { getAppConfig, toPublicConfig } from "@/lib/config";` 與 `import { AppConfigProvider } from "@/components/providers/app-config-provider";`
  - `generateMetadata` 改為:

```tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const config = getAppConfig();
  const title = config.company.isDefault
    ? t("title")
    : `${config.company.name} | ${t("title")}`;

  return {
    title,
    description: t("description"),
    icons: { icon: "/api/branding-icon" },
  };
}
```

  - `RootLayout` 內加 `const publicConfig = toPublicConfig(getAppConfig());`,並以 `<AppConfigProvider value={publicConfig}>` 包住 `<NextIntlClientProvider>`(provider 放在 NextIntlClientProvider 外或內皆可,選外層)。
- [ ] **Step 3: 改 messages** — `messages/en.json` 的 `Metadata.title` → `"Quote System"`;`messages/zh-TW.json` 的 `Metadata.title` → `"報價系統"`。
- [ ] **Step 4: 驗證後 commit** — `npm test && npx tsc --noEmit`;`git add -A && git commit -m "feat(config): inject client-safe config via provider, white-label metadata"`

---

### Task 4: 預設 logo、favicon route、作者資料遷移、移除公司圖示

**Files:**
- Create: `branding-defaults/logo.png`(程式產生的中性幾何圖)
- Create: `app/api/branding-icon/route.ts`
- Create(本機,不進 git): `branding/logo.png`、`branding/stamp.png`、`branding/icon.png`、`.env` 追加設定
- Modify: `.gitignore`
- Delete: `public/favicon.ico`、`public/favicon-16x16.png`、`public/favicon-32x32.png`、`public/apple-touch-icon.png`、`public/android-chrome-192x192.png`、`public/android-chrome-512x512.png`、`public/site.webmanifest`
- 本機搬移: `lib/company-info.ts` → `branding/company-info.legacy.ts`

**Interfaces:**
- Consumes: `getBrandingFile`(Task 1)。

- [ ] **Step 1: 產生 `branding-defaults/logo.png`** — 用 node 內建 zlib 手寫 PNG(256×256,靛藍色圓盤 + 白色圓環,中性幾何標誌)。執行下述 script(存到 scratchpad 執行,不進 repo):

```js
// generate-logo.mjs — 手工組 PNG chunks(RGBA、filter 0、zlib deflate)
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 256, H = 256, CX = 128, CY = 128;
const DISC_R = 110, RING_OUTER = 74, RING_INNER = 50;
const INDIGO = [79, 70, 229, 255], WHITE = [255, 255, 255, 255], NONE = [0, 0, 0, 0];

const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  const row = y * (1 + W * 4);
  raw[row] = 0; // filter: None
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - CX, y - CY);
    let px = NONE;
    if (d <= DISC_R) px = INDIGO;
    if (d <= RING_OUTER && d >= RING_INNER) px = WHITE;
    raw.set(px, row + 1 + x * 4);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(process.argv[2] ?? "branding-defaults/logo.png", png);
console.log("wrote", png.length, "bytes");
```

執行:`mkdir -p branding-defaults && node <scratchpad>/generate-logo.mjs branding-defaults/logo.png`,並用 `file branding-defaults/logo.png` 確認是 `PNG image data, 256 x 256`。

- [ ] **Step 2: 建 `app/api/branding-icon/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getBrandingFile } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const icon = getBrandingFile("icon");
  if (!icon) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(icon), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

- [ ] **Step 3: 作者資料遷移(本機)** — 以 node script(regex 抽取 `lib/company-info.ts` 的欄位與 base64)執行:
  1. `mkdir -p branding`
  2. `logoBase64`/`stampBase64` 的 data URI 去掉前綴解碼,寫入 `branding/logo.png`、`branding/stamp.png`
  3. `cp public/android-chrome-512x512.png branding/icon.png`(在刪除 public 圖示之前!)
  4. `.env` **append**(不動既有行):`COMPANY_NAME`、`COMPANY_NAME_LOCAL`、`COMPANY_ADDRESS`、`COMPANY_VAT_NUMBER`、`COMPANY_EMAIL`、`COMPANY_PHONE`、`BANK_NAME`、`BANK_ACCOUNT_NAME`、`BANK_ACCOUNT_NUMBER`、`MAIL_SENDER_NAME`、`MAIL_SENDER_EMAIL`、`MAIL_CC_EMAILS`(值取自 company-info.ts;`CURRENCY`/`CURRENCY_LOCALE`/`DEFAULT_TAX_RATE` 用預設不需寫)
  5. 用 `cmp` 驗證解碼後的 PNG 與原 base64 一致、`file` 驗證是 PNG
- [ ] **Step 4: `.gitignore` 更新** — 移除 `*company-info.ts` 行;在 `# postgres` 區塊後新增:

```
# branding (per-company assets, see branding-defaults/ for fallbacks)
/branding/
```

- [ ] **Step 5: 搬移 legacy 檔 + 刪除公司圖示** — `mv lib/company-info.ts branding/company-info.legacy.ts`(此時尚有 4 個 import,`tsc` 會暫時紅 — 本 task 先不跑 tsc,Task 5/6 會移除所有 import;為保每個 commit 可編譯,**Step 5 的 git 操作延到 Task 6 結束一起 commit** 是錯的 — 改成:`git rm` public 圖示與 webmanifest 現在做,`mv company-info` **留到 Task 6 完成後**執行)。本 step 實際動作:

```bash
git rm public/favicon.ico public/favicon-16x16.png public/favicon-32x32.png \
  public/apple-touch-icon.png public/android-chrome-192x192.png \
  public/android-chrome-512x512.png public/site.webmanifest
```

- [ ] **Step 6: 驗證後 commit** — `npm test && npx tsc --noEmit`(company-info.ts 未動,仍可編譯);`git add -A && git commit -m "feat(branding): default logo, runtime favicon route, drop company icons"`

---

### Task 5: PDF / Email / 寄信 action / PDF route 改 props 注入

**Files:**
- Modify: `components/pdf/QuotePDFDocument.tsx`
- Modify: `components/emails/quote-template.tsx`
- Modify: `actions/send-email.tsx`
- Modify: `app/[locale]/quotes/[id]/pdf/route.tsx`

**Interfaces:**
- Consumes: `QuoteBranding`、`getQuoteBranding()`(Task 1)、`formatCurrency`(Task 2)、`getAppConfig`(Task 1)。
- Produces: `QuotePDFDocument({ quote, branding }: { quote: any; branding: QuoteBranding })`、`QuoteEmail({ quote, branding }: { quote: any; branding: QuoteBranding })`。

- [ ] **Step 1: `components/pdf/QuotePDFDocument.tsx`**
  - 移除 `import { COMPANY_INFO, PAYMENT_INFO } from "@/lib/company-info";`,加 `import { formatCurrency } from "@/lib/utils";` 與 `import type { QuoteBranding } from "@/lib/config";`
  - 刪除檔內 `fmtMoney`,元件簽名改 `({ quote, branding }: { quote: any; branding: QuoteBranding })`,函式內定義 `const fmtMoney = (cents: number) => formatCurrency(cents, branding.money);`
  - Header 區:`COMPANY_INFO.logoBase64` → `branding.logoDataUri`;`COMPANY_INFO.name` → `branding.company.name`;`chineseName` 行改條件渲染 `{branding.company.nameLocal ? <Text style={styles.brandSub}>{branding.company.nameLocal}</Text> : null}`;address/VAT 行同樣條件渲染(`vatNumber` 有值才顯示 `VAT: {...}`)。
  - Footer 區:Bank Details 區塊整段包 `{branding.payment ? (...) : null}`,其中每行有值才渲染;stamp 改 `{branding.stampDataUri ? <Image src={branding.stampDataUri} style={styles.stampImage} /> : null}`。
- [ ] **Step 2: `components/emails/quote-template.tsx`**
  - 移除 company-info import,加 `import { formatCurrency } from "@/lib/utils";` 與 `import type { QuoteBranding } from "@/lib/config";`
  - 簽名改 `({ quote, branding }: { quote: any; branding: QuoteBranding })`;`fmtMoney` 改用 `formatCurrency(cents, branding.money)`
  - `COMPANY_INFO.name` → `branding.company.name`(Preview、標題下方、footer);Payment Details 區塊包 `{branding.payment ? (...) : null}`;footer 的 address 行與 email 連結各自有值才渲染。
- [ ] **Step 3: `actions/send-email.tsx`**

```tsx
"use server";

import { Resend } from "resend";
import { db } from "@/db";
import { quotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { QuoteEmail } from "@/components/emails/quote-template";
import { QuotePDFDocument } from "@/components/pdf/QuotePDFDocument";
import { renderToBuffer, Font } from "@react-pdf/renderer";
import path from "path";
import process from "process";
import { getAppConfig, getQuoteBranding } from "@/lib/config";
import { revalidatePath } from "next/cache";

Font.register({
  family: "Noto Sans TC",
  src: path.join(process.cwd(), "public", "fonts", "NotoSansTC-Regular.ttf"),
});

type SendEmailState = {
  success?: boolean;
  error?: string;
};

export async function sendQuoteEmail(quote: any): Promise<SendEmailState> {
  try {
    const config = getAppConfig();
    if (!config.mail.enabled) {
      return { error: "Email is not configured (RESEND_API_KEY is missing)" };
    }
    if (!quote || !quote.customer?.email) {
      return { error: "No customer email found" };
    }

    const branding = getQuoteBranding();
    const resend = new Resend(process.env.RESEND_API_KEY);

    const pdfBuffer = await renderToBuffer(
      <QuotePDFDocument quote={quote} branding={branding} />
    );

    const { error } = await resend.emails.send({
      from: `${config.mail.senderName} <${config.mail.senderEmail}>`,
      to: [quote.customer.email],
      cc: config.mail.ccEmails.length ? config.mail.ccEmails : undefined,
      subject: `Quotation #${quote.quotationNumber} from ${config.company.name}`,
      react: <QuoteEmail quote={quote} branding={branding} />,
      attachments: [
        {
          filename: `Quote-${quote.quotationNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("Resend error:", error);
      return { error: error.message };
    }

    if (quote.id) {
      await db
        .update(quotations)
        .set({ status: "sent" })
        .where(eq(quotations.id, quote.id));

      revalidatePath(`/quotes/${quote.id}`);
      revalidatePath("/");
    }

    return { success: true };
  } catch (err) {
    console.error("Failed to send email:", err);
    return { error: "Failed to send email" };
  }
}
```

- [ ] **Step 4: `app/[locale]/quotes/[id]/pdf/route.tsx`** — 加 `import { getQuoteBranding } from "@/lib/config";`,render 行改 `renderToStream(<QuotePDFDocument quote={quote} branding={getQuoteBranding()} />)`。
- [ ] **Step 5: 驗證後 commit** — `npm test && npx tsc --noEmit`(此時 company-info 只剩 `app/[locale]/quotes/[id]/page.tsx` 引用);`git add -A && git commit -m "refactor(render): PDF/email take QuoteBranding props instead of company-info import"`

---

### Task 6: 詳細頁 + 寄信按鈕停用態 + i18n

**Files:**
- Modify: `app/[locale]/quotes/[id]/page.tsx`
- Modify: `components/quote-actions.tsx`
- Modify: `components/send-email-button.tsx`
- Modify: `messages/en.json`、`messages/zh-TW.json`(QuoteActions 加 key)
- 本機搬移: `lib/company-info.ts` → `branding/company-info.legacy.ts`

**Interfaces:**
- Consumes: `getQuoteBranding`、`getAppConfig`(Task 1)。
- Produces: `QuoteActions({ quote, mailEnabled }: { quote: QuoteWithRelations; mailEnabled: boolean })`;`SendEmailButton({ quote, mailEnabled }: ...)`。

- [ ] **Step 1: `app/[locale]/quotes/[id]/page.tsx`**
  - Import 改:移除 company-info 行,加 `import { getAppConfig, getQuoteBranding } from "@/lib/config";`
  - Function 開頭(取得 quote 後)加:`const branding = getQuoteBranding();` 與 `const mailEnabled = getAppConfig().mail.enabled;`
  - `<QuoteActions quote={quote} />` → `<QuoteActions quote={quote} mailEnabled={mailEnabled} />`
  - Header:`COMPANY_INFO.logoBase64` → `branding.logoDataUri`;`COMPANY_INFO.name` → `branding.company.name`;`Tech Solutions Provider` 那個 `<p>` 改 `{branding.company.nameLocal ? (<p className="text-sm text-slate-500">{branding.company.nameLocal}</p>) : null}`
  - 聯絡資訊四行(address/email/phone/vatNumber)各自包 `{branding.company.address ? (...) : null}` 等條件。
  - `<InfoField label="Currency" value="TWD (NT$)" />` → `<InfoField label="Currency" value={branding.money.currency} />`
  - `format.number(totalAmount / 100, { style: "currency", currency: "TWD", ... })` → `currency: branding.money.currency`(共 1 處)+ `SummaryRow` 改收 `currency: string` prop 並用之(2 處呼叫加 `currency={branding.money.currency}`)。
  - Payment Details 卡片整段包 `{branding.payment ? (...) : null}`,其中 Bank/Account/No 各行有值才渲染;簽名區 `COMPANY_INFO.name` → `branding.company.name`。
- [ ] **Step 2: `components/quote-actions.tsx`** — props 加 `mailEnabled: boolean`,`<SendEmailButton quote={quote} mailEnabled={mailEnabled} />`。
- [ ] **Step 3: `components/send-email-button.tsx`** — props 加 `mailEnabled: boolean`;在 `if (!email)` 之前加:

```tsx
if (!mailEnabled) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled
      title={t("emailNotConfigured")}
    >
      <Mail className="mr-2 h-4 w-4" /> {t("emailNotConfigured")}
    </Button>
  );
}
```

- [ ] **Step 4: i18n key** — `messages/en.json` QuoteActions 加 `"emailNotConfigured": "Email not configured"`;`messages/zh-TW.json` 加 `"emailNotConfigured": "尚未設定寄信功能"`。
- [ ] **Step 5: 全 repo 確認 company-info 零引用** — `grep -rn "company-info" --include="*.ts" --include="*.tsx" . --exclude-dir=node_modules --exclude-dir=.next` 應為 0 筆;執行 `mv lib/company-info.ts branding/company-info.legacy.ts`。
- [ ] **Step 6: 驗證後 commit** — `npm test && npx tsc --noEmit`;`git add -A && git commit -m "refactor(quotes): detail page uses runtime branding, email button disabled without key"`

---

### Task 7: 報價表單與新增頁設定化

**Files:**
- Modify: `components/quote-form.tsx`(line 53 預設稅率、4 處 `currency: "TWD"`)
- Modify: `app/[locale]/quotes/new/page.tsx`(taxRate: 5)

**Interfaces:**
- Consumes: `useAppConfig`(Task 3)、`getAppConfig`(Task 1)。

- [ ] **Step 1: `components/quote-form.tsx`**
  - 加 `import { useAppConfig } from "@/components/providers/app-config-provider";`
  - Component 開頭加 `const { currency, defaultTaxRate } = useAppConfig();`
  - `taxRate: initialData.taxRate ?? 5` → `taxRate: initialData.taxRate ?? defaultTaxRate`
  - 4 處 `currency: "TWD"` → `currency`(shorthand,行 291/346/373/384 的 `format.number` options)。
- [ ] **Step 2: `app/[locale]/quotes/new/page.tsx`** — 加 `import { getAppConfig } from "@/lib/config";`,`taxRate: 5` → `taxRate: getAppConfig().money.defaultTaxRate`。
- [ ] **Step 3: 驗證後 commit** — `npm test && npx tsc --noEmit`;`git add -A && git commit -m "refactor(form): currency and default tax rate from app config"`

---

### Task 8: 基礎設施 — Docker、CI、deploy 防護、依賴清理

**Files:**
- Modify: `docker-compose.yaml`、`Dockerfile`、`.github/workflows/deploy.yml`、`package.json`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: `docker-compose.yaml`** — app service 改為:

```yaml
  app:
    container_name: quote-system-web
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/quote-system
    volumes:
      - ./branding:/app/branding
    depends_on:
      - postgres
```

(`environment` 放在 `env_file` 之後覆蓋 DATABASE_URL,確保容器內連 compose 網路的 postgres;其餘公司設定由 `.env` 帶入。postgres service 不動。)

- [ ] **Step 2: `Dockerfile`** — 在 `COPY --from=builder /app/public ./public` 之後加:

```dockerfile
COPY --from=builder /app/branding-defaults ./branding-defaults
```

- [ ] **Step 3: `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 4: `.github/workflows/deploy.yml`** — `build-and-push` job 加 `if: github.repository_owner == 'sychen6192'`;tags 改 `ghcr.io/${{ github.repository }}:latest`(下方 pull/run 同步改);`deploy-to-homelab` job 同樣加 owner 條件,`docker run` 改:

```yaml
          docker run -d --name my-next-app -p 3000:3000 \
            --env-file $HOME/quote-system/.env \
            -v $HOME/quote-system/branding:/app/branding \
            ghcr.io/${{ github.repository }}:latest
```

- [ ] **Step 5: `package.json`** — 移除 `"nodemailer"` 與 `"@types/nodemailer"`,執行 `npm install` 更新 lockfile,`npm test` 確認無破壞。
- [ ] **Step 6: commit** — `git add -A && git commit -m "chore(infra): CI workflow, guarded deploy, docker branding mount, drop nodemailer"`

---

### Task 9: 開源文件 — LICENSE、.env.example、README(EN + zh-TW)

**Files:**
- Create: `LICENSE`(MIT, Copyright (c) 2026 Jack SY Chen)
- Create: `.env.example`(所有變數 + 註解,DATABASE_URL 用 `postgres://postgres:postgres@localhost:5432/quote-system`)
- Create: `README.zh-TW.md`
- Rewrite: `README.md`(英文)

**內容要求(兩個 README 結構一致、互相連結):**
1. 標題 + 一句話介紹 + badges 免(YAGNI)
2. Features(報價 CRUD、即時計算、金額用分、PDF、Email、i18n en/zh-TW、白牌設定)
3. Quickstart(零設定即跑):`git clone` → `npm install` → `docker compose up -d postgres`(只起 DB)→ 建 `.env` 含 `DATABASE_URL=postgres://postgres:postgres@localhost:5432/quote-system` → `npm run db:push` → `npm run dev` — 未設定品牌時顯示 "Your Company" 與預設 logo
4. Configuration:完整 env 表(同 spec)+ `branding/` 圖檔表(logo.png/stamp.png/icon.png 與 fallback 行為)+ 「不設 RESEND_API_KEY 寄信按鈕停用」說明
5. Docker 部署:`docker compose up -d`(全套)或單獨 `docker run --env-file .env -v ./branding:/app/branding ...`
6. **Security 節**:無登入驗證,設計給內網/信任環境;公開部署請加反向代理驗證(如 Cloudflare Access、Authelia)
7. Project Structure(現有結構簡表)+ Scripts 表(dev/build/test/db:push/db:studio)
8. Roadmap(auth、settings UI、多幣別 — 標明 PR welcome)
9. Contributing 小節(fork → branch → PR;CI 會跑 lint/test/build)
10. License(MIT)

- [ ] **Step 1: 寫 LICENSE**(標準 MIT 全文)
- [ ] **Step 2: 寫 `.env.example`**(每個變數一行註解;真實值一律 placeholder)
- [ ] **Step 3: 重寫 `README.md`(英文)**;**Step 4: 寫 `README.zh-TW.md`**(繁中,同結構)
- [ ] **Step 5: commit** — `git add -A && git commit -m "docs: MIT license, env example, bilingual open-source README"`

---

### Task 10: 全面驗證(對照 spec 驗收標準)

- [ ] **Step 1: 測試 + 型別 + lint** — `npm test`、`npx tsc --noEmit`、`npm run lint` 全綠。
- [ ] **Step 2: 乾淨 clone build 模擬** — `mv .env /tmp掩蔽 && mv branding /tmp掩蔽`(實際用 scratchpad 路徑)→ `npm run build` 成功 → 還原。期間確認 build 未連 DB(無 .env 下 build 過即證明)。
- [ ] **Step 3: 敏感值不進 client bundle** — `grep -rl "BANK_ACCOUNT\|accountNumber\|senderEmail" .next/static/` 應為空。
- [ ] **Step 4: 公司資料零殘留** — `git grep -iE "聖大|shangda|shanda|sycomputer|teching|qazxsw|50990180|54040269" -- ':!docs/superpowers'` 只允許 deploy.yml 的 `sychen6192` owner 條件(GitHub 帳號名,非機密)。docs/specs 內的歷史敘述以 repo 為準檢視:spec 不含真實銀行帳號/信箱(僅欄位名),允許。
- [ ] **Step 5: Placeholder dev 冒煙測試** — 屏蔽 `.env`(只留 DATABASE_URL)與 `branding/` → `docker compose up -d postgres`(或用既有 DB)→ `npm run dev` → curl `/zh-TW`、`/zh-TW/quotes`、`/zh-TW/quotes/new`、`/api/branding-icon`:200、出現 "Your Company"、favicon 是預設 logo bytes、詳細頁無 Payment 卡、寄信按鈕 disabled(有資料時)。
- [ ] **Step 6: 作者設定冒煙測試** — 還原 `.env` 與 `branding/` → dev 重啟 → 詳細頁顯示聖大資訊/logo/大小章、`/quotes/{id}/pdf`(經 `/api/quotes/{id}/pdf`)可下載且含 Bank Details、metadata title 為公司名。
- [ ] **Step 7: Standalone 驗證** — `cp -r branding-defaults .next/standalone/ && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/` 後以無公司 env 起 `node .next/standalone/server.js`,curl `/api/branding-icon` 回預設 logo(驗 Dockerfile 假設)。
- [ ] **Step 8: 殘項確認** — `git status` 乾淨(除本機 branding/、.env);任務清單全部 completed;必要修正以 `fix:` commit 補上。

---

## Self-Review 紀錄

- Spec 覆蓋:設定層(T1)、幣別集中(T2/T5/T6/T7)、client 注入(T3)、branding+favicon+遷移(T4)、PDF/Email(T5)、詳細頁/按鈕(T6)、表單(T7)、infra/CI/deploy(T8)、docs(T9)、驗收(T10)— spec「檔案層級變更清單」每列皆有對應 task。
- 型別一致:`QuoteBranding`/`PublicAppConfig`/`formatCurrency(cents, money)` 簽名在 T1/T2 定義,T3–T7 引用一致;`mailEnabled` prop 在 T6 兩個元件簽名一致。
- 每 task 結尾有測試/型別驗證與 commit;company-info 的移除橫跨 T5/T6,期間檔案保留原位確保可編譯,T6 Step 5 確認零引用後才搬移。
