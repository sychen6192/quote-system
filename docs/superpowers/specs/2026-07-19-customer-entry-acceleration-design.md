# 客戶輸入加速設計(Customer Entry Acceleration)

**日期**: 2026-07-19
**專案**: quote-system
**目標**: 在報價表單「客戶資料」區大幅減少打字 —— (C) 從曾處理過的公司搜尋並自動填入,(B) 輸入統編一鍵查詢帶入公司名與地址(台灣專屬、可選、預設關)。

## 背景

- `createQuote` 每次都新增一筆 `customers`(不去重),因此 `customers` 表已累積所有處理過的公司(含重複)。功能 C 的資料已存在,只需「去重撈出 + 選單填入」。
- 專案已開源白牌(任一國家可用)。統編查詢是台灣專屬,**必須可選、預設關**,不破壞通用性。

## 已確認決策

| 決策 | 結論 |
|---|---|
| 統編查詢觸發 | 統編欄旁「查詢」按鈕(explicit,不自動) |
| 選既有公司 UI | 公司名稱欄改可搜尋下拉(打字即篩選) |
| 統編 API | 經濟部商業司 GCIS 開放資料(免金鑰、免費),dataset `5F64D864-61CB-4D0D-8AD9-492047CC1EA6` |
| 開源相容 | 統編查詢以 env `TW_VAT_LOOKUP` gate,預設關 |

## 架構設計

### 1. 既有公司選單(功能 C)

**服務** `services/customers.ts`:
```ts
export type CustomerOption = {
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  address: string | null;
};
// 去重:同 companyName 取最新一筆(id desc);上限 500 筆
export function getCustomerOptions(): Promise<CustomerOption[]>;
```
- 實作:`SELECT DISTINCT ON (company_name) ...` 以 Drizzle 表達(或抓後在 JS 去重,以 id desc 取第一筆)。為可攜性採「抓 companyName/欄位 order by id desc,再於 JS 依 companyName 去重」。

**元件** `components/company-combobox.tsx`(client,輕量、無新依賴):
- Props:`value: string`、`onChange(value)`、`onSelect(option: CustomerOption)`、`options: CustomerOption[]`、`placeholder`、`disabled`、`id`。
- 行為:內含 `<Input>`;聚焦且有輸入時,於下方顯示絕對定位清單,列出 `options` 中 **companyName 或 vatNumber 命中查詢字串**者(上限 8 筆);點一項 → `onSelect(option)`;可照常自由打字(值透過 `onChange` 回寫)。
- 關閉:blur(延遲以允許點選)、Esc、選取後。
- 樣式沿用現有 token(border/rounded-md/shadow/bg-popover),深色相容;項目 hover `bg-accent`。

**表單接線** `components/quote-form.tsx`:
- 新增 prop `companyOptions: CustomerOption[]`(預設 `[]`)。
- 公司名稱 `FormField` 換成 `CompanyCombobox`,綁 `companyName`;`onSelect` 用 `form.setValue` 一次填 companyName/contactPerson/email/phone/vatNumber/address(`shouldValidate: true`、`shouldDirty: true`)。
- `app/[locale]/quotes/new/page.tsx` 與 `.../[id]/edit/page.tsx`:呼叫 `getCustomerOptions()` 並以 prop 傳入。

### 2. 統編查詢(功能 B,台灣專屬、可選)

**設定** `lib/config.ts`:
- `AppConfig` 增 `features: { twVatLookup: boolean }`(= `TW_VAT_LOOKUP` 經 `clean()` 後為 `"1"`/`"true"` 時 true;預設 false)。
- `PublicAppConfig` 增 `twVatLookup: boolean`(client 需知是否渲染按鈕);`toPublicConfig` 帶出。

**GCIS 純函式** `lib/gcis.ts`(可測試,不含 I/O 與 fetch 分離):
```ts
export type VatCompany = { companyName: string; address: string; responsibleName: string; status: string };
// 解析 GCIS 回傳陣列 → 第一筆映射;空陣列/格式不符 → null
export function parseGcisResponse(json: unknown): VatCompany | null;
export function gcisUrl(vat: string): string; // 組 OData query URL
```
映射:`Company_Name`→companyName、`Company_Location`→address、`Responsible_Name`→responsibleName、`Company_Status_Desc`→status。

**Server action** `actions/lookup-vat.ts`:
```ts
export type VatLookupResult =
  | { ok: true; company: VatCompany }
  | { ok: false; reason: 'DISABLED' | 'INVALID' | 'NOT_FOUND' | 'ERROR' };
export async function lookupVatNumber(vat: string): Promise<VatLookupResult>;
```
- 防禦:`getAppConfig().features.twVatLookup` 為 false → `DISABLED`。
- 驗證:非 8 位數字 → `INVALID`。
- `fetch(gcisUrl(vat))` 加 `AbortSignal.timeout(8000)`;非 2xx 或 throw → `ERROR`;`parseGcisResponse` 為 null → `NOT_FOUND`;否則 `ok`。

**UI**(`quote-form.tsx` 統編欄):
- `useAppConfig().twVatLookup` 為 true 時,統編欄右側顯示「查詢」按鈕(loading 態 spinner)。
- 點擊 → `lookupVatNumber(vatNumber)`:`ok` → `setValue` 帶入 companyName 與 address(若 contactPerson 空,填 responsibleName);toast 成功。其餘 reason → 對應 toast(`INVALID`/`NOT_FOUND`/`ERROR`;`DISABLED` 理論上不會遇到,fallback 錯誤)。

## 錯誤處理

| 情境 | 行為 |
|---|---|
| `TW_VAT_LOOKUP` 未開 | 查詢按鈕不渲染;action 回 `DISABLED` |
| 統編非 8 碼 | toast「請輸入 8 位數統編」 |
| 查無公司 | toast「查無此統編」 |
| API 逾時/錯誤 | toast「查詢失敗,請稍後再試或手動輸入」 |
| combobox 無相符 | 不顯示清單,照常打字 |

## 測試策略

1. **`tests/unit/lib/gcis.test.ts`(TDD)**:`parseGcisResponse` — 正常物件陣列 → 正確映射;空陣列 → null;缺欄位/非陣列 → null;`gcisUrl` 含正確 filter。
2. **`tests/unit/actions/lookup-vat.test.ts`(TDD,mock `getAppConfig` 與全域 `fetch`)**:disabled → DISABLED(未呼叫 fetch);非 8 碼 → INVALID;fetch 回空陣列 → NOT_FOUND;fetch throw/非 2xx → ERROR;正常 → ok + 映射。
3. **既有測試**:全數維持綠。
4. **實機驗收(playwright)**:
   - 選既有公司 → 全欄位自動填入;
   - 輸入台積電統編 `22099131` 按查詢 → 公司名「台灣積體電路製造股份有限公司」、地址帶入;
   - 關閉 flag → 查詢按鈕消失;
   - combobox 深色相容。

## 檔案清單

| 動作 | 檔案 |
|---|---|
| 新增 | `lib/gcis.ts`、`actions/lookup-vat.ts`、`components/company-combobox.tsx`、`services/customers.ts` |
| 新增測試 | `tests/unit/lib/gcis.test.ts`、`tests/unit/actions/lookup-vat.test.ts` |
| 修改 | `lib/config.ts`(features + PublicAppConfig)、`components/quote-form.tsx`、`app/[locale]/quotes/new/page.tsx`、`app/[locale]/quotes/[id]/edit/page.tsx`、`.env.example`(加 `TW_VAT_LOOKUP=`)、`messages/en.json`、`messages/zh-TW.json` |

## 明確不做(YAGNI)

- 不新增 customers 去重的資料庫 migration(用查詢層去重即可)。
- 不做客戶 CRUD 管理頁(只在報價表單填入)。
- 不快取 GCIS 結果、不接多個 API 來源(單一官方來源足夠)。
- 不動金額/稅率邏輯、不動 PDF、不動既有樣式方向(A)。
- 商號/行號查不到時不特別處理,fallback 讓使用者手填(toast 提示)。

## 前置條件(使用者操作)

- 你的機器 `/opt/quote-system/.env` 加 `TW_VAT_LOOKUP=1` 才會出現查詢按鈕(部署後)。本機 `.env` 同樣加。
