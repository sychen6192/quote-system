# UI/UX 重構設計文件(現代 SaaS 風 + 雙主題)

**日期**: 2026-07-19
**專案**: quote-system
**目標**: 將全站 UI 從 shadcn 預設中性灰,重構為「現代 SaaS」視覺語言(靛紫主色、漸層統計卡、彩色狀態標籤、卡片陰影、大圓角),並加入淺色/深色雙主題切換。對外的發票詳細頁維持白底不受深色影響。

## 已確認決策(來自視覺 companion 選擇)

| 決策 | 結論 |
|---|---|
| 範圍 | 全站:設計系統 + App 介面(儀表板/列表/表單)+ 詳細頁 App 外框 + 列印/PDF 輕度精修 |
| 風格 | **B 現代 SaaS**:漸層彩色統計卡、卡片陰影、大圓角、彩色狀態 pill |
| 主色 | 靛紫 indigo `#6366f1` → violet `#8b5cf6` |
| 深色模式 | **雙主題 + 右上切換鈕**,記住選擇;預設淺色;發票文件恆白底 |

## 設計系統(Design Tokens)

改寫 `app/[locale]/globals.css` 的 CSS 變數(shadcn HSL 格式)。

### 調色盤

| Token | 淺色 | 深色 |
|---|---|---|
| `--background` | `0 0% 100%` | `222 47% 7%`(#0b1120) |
| `--foreground` | `222 47% 11%` | `210 40% 96%` |
| `--card` | `0 0% 100%` | `221 39% 16%`(#18233b) |
| `--muted` | `220 14% 96%` | `217 33% 20%` |
| `--muted-foreground` | `220 9% 46%` | `215 20% 65%` |
| `--border` | `220 13% 91%` | `217 33% 23%`(#24314e) |
| `--input` | `220 13% 91%` | `217 33% 23%` |
| `--primary` | `239 84% 67%`(indigo #6366f1) | `239 84% 70%` |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--ring` | `239 84% 67%` | `239 84% 70%` |
| `--accent` | `238 100% 97%`(indigo-50) | `217 33% 20%` |
| `--radius` | `0.75rem`(圓角加大) | 同 |

### 品牌漸層與狀態色(新增 CSS 變數 + Tailwind 工具類)

於 `globals.css` 定義,供漸層統計卡與品牌按鈕使用:

```css
--grad-brand: linear-gradient(135deg, #6366f1, #8b5cf6);   /* 主色/總營收 */
--grad-sky:   linear-gradient(135deg, #0ea5e9, #22d3ee);   /* 報價單數 */
--grad-amber: linear-gradient(135deg, #f59e0b, #f97316);   /* 客戶數 */
--shadow-brand: 0 12px 26px -10px rgba(99,102,241,.55);    /* 品牌卡/按鈕陰影 */
```

狀態色以語意類別定義(淺/深各一組),用於統一的狀態標籤:

| 狀態 | 淺色 (bg / text) | 深色 (bg / text) |
|---|---|---|
| draft 草稿 | slate-100 / slate-600 | slate-700/40 / slate-300 |
| sent 已發送 | blue-100 / blue-700 | blue-900/50 / blue-200 |
| accepted 已成交 | green-100 / green-700 | green-900/50 / green-200 |
| rejected 已拒絕 | red-100 / red-700 | red-900/50 / red-200 |
| expired 已過期 | amber-100 / amber-700 | amber-900/50 / amber-200 |

### 字型與圓角

- 維持現有 `Inter`(拉丁)+ 系統 CJK 疊字;強化層級:頁標題 `text-3xl font-bold tracking-tight`、卡標題 `font-semibold`、數字用 `tabular-nums` 與 `tracking-tight`。
- 圓角統一走 `--radius`(卡片 `rounded-xl`、pill `rounded-full`)。
- 金額一律 `font-variant-numeric: tabular-nums`,右對齊。

## 主題基礎設施(next-themes,已安裝)

- 新增 `components/providers/theme-provider.tsx`:包 `next-themes` 的 `ThemeProvider`(`attribute="class"`、`defaultTheme="light"`、`enableSystem={false}`、`disableTransitionOnChange`)。
- `app/[locale]/layout.tsx`:`<html>` 加 `suppressHydrationWarning`;在 body 內、`AppConfigProvider` 之外包 `ThemeProvider`。
- 新增 `components/theme-toggle.tsx`(client):日/月 icon 按鈕,`useTheme()` 切換,`mounted` 判斷避免 hydration 閃爍。
- 深色類別 `.dark` 掛在 `<html>`(shadcn 慣例);globals.css 的 `.dark` 區塊更新為上表深色 token。

## App Shell(共用頂欄 + 導覽)

現況每頁各自寫 header、語言切換只在儀表板。新增共用頂欄改善一致性與導覽。

- 新增 `components/app-shell/top-nav.tsx`(client):sticky 頂欄,含
  - 左:品牌(favicon logo `/api/branding-icon` + `useAppConfig().companyName`),點擊回 `/`
  - 中/右:導覽連結(儀表板、報價單),`usePathname` 高亮當前頁
  - 最右:`LanguageSwitcher` + `ThemeToggle`
  - `className="... print:hidden"`(列印時隱藏)
- `app/[locale]/layout.tsx` 在 children 上方渲染 `<TopNav/>`;頁面內原本的「返回儀表板／語言切換」等重複元素移除。
- 各頁改用統一容器 `mx-auto max-w-6xl px-4 md:px-6 py-6`。

## 元件級重構

| 檔案 | 變更 |
|---|---|
| `components/dashboard/stat-card.tsx` | 新增 `variant: "brand"\|"sky"\|"amber"\|"plain"`;brand/sky/amber 用對應漸層背景 + 白字 + 白 icon + `--shadow-brand`;`plain` 為卡片式(次要指標)。儀表板三張卡分別用 brand/sky/amber。 |
| `components/quotes/quote-status-badge.tsx` | **重寫為統一 `StatusBadge`**:input 改吃 `status`(draft/sent/accepted/rejected)+ 選配 `validUntil`(過期時疊加 expired 樣式);輸出對應語意色 pill。抽出純函式 `statusStyle(status)` 供測試。 |
| `components/quotes/quotes-table.tsx` | 現代表格:表頭 `bg-muted/40 text-xs uppercase tracking-wide`、列 hover `bg-muted/50`、客戶欄加**色塊頭像**(公司名首字,漸層底)、金額 `tabular-nums` 右對齊;狀態欄改用新 `StatusBadge`(以 `status` 為主),移除只看 validUntil 的舊邏輯。 |
| `components/dashboard/recent-quotes-table.tsx` | 同上表格語言;狀態改用新 `StatusBadge`;金額右對齊。 |
| `components/quote-form.tsx` | 卡片式分區(客戶資料/項目/總計);input `focus-visible:ring-2 ring-primary/40`;**總計改漸層卡**(`--grad-brand` + 白字大字);項目表列樣式一致;sticky 行動列按鈕用品牌漸層。 |
| `components/ui/button.tsx` | `default` variant 改品牌:`bg-primary`(靛),另加 `gradient` variant(`--grad-brand` + `--shadow-brand`)供主要 CTA(建立/儲存/寄送)。 |
| `components/ui/badge.tsx` | 補 pill 尺寸與語意色 variant(供 StatusBadge 使用)。 |
| `components/ui/card.tsx` | 預設 `rounded-xl` + 柔和陰影 `shadow-sm`;hover 卡加 `transition`。 |
| `app/[locale]/page.tsx` | 儀表板:三張漸層 StatCard(brand/sky/amber)、`RecentQuotesTable` 卡片化;頁首標題層級強化;移除重複語言切換(移到頂欄)。 |
| `app/[locale]/quotes/page.tsx` | 套統一容器與頁首;`QuotesTable` 卡片包裹;空狀態插圖式(icon + 文案 + CTA)。 |
| `app/[locale]/loading.tsx` | 骨架載入(skeleton)配合新卡片版型。 |

## 詳細頁 / 發票 / 列印 / PDF

- **發票文件恆白底**:`app/[locale]/quotes/[id]/page.tsx` 的 `#printable-content` 已使用硬編碼 `bg-white / text-slate-*`(不吃主題 token),深色模式下自然維持白底 —— 僅需確保**外層頁面背景與動作列**吃主題(深色時外框深、文件仍白),並在文件容器加 `.bg-white text-slate-900` 明確鎖定。
- 動作列(返回/匯出/寄送)改用新按鈕樣式與 `StatusBadge`(Valid/Expired 沿用 expired 樣式)。
- **列印 CSS**(globals.css `@media print`):維持隱藏非 `#printable-content` 的邏輯;微調間距讓單頁更穩;頂欄 `print:hidden` 已涵蓋。
- **PDF**(`components/pdf/QuotePDFDocument.tsx`):**輕度**精修 —— 品牌色標題底線、狀態徽章顏色對齊網頁語意色、金額 tabular 對齊。**不改版面結構**(降低對外文件風險)。純 props 元件,不吃主題。

## 無障礙與品質

- 對比:所有文字/背景組合達 WCAG AA(漸層卡上白字、pill 文字對比實測)。
- 焦點可見:互動元件 `focus-visible` 環(primary 40%)。
- 主題切換不造成 hydration 閃爍(mounted gate + `disableTransitionOnChange`)。
- `prefers-reduced-motion`:過場動畫降級。

## 測試 / 驗收

1. **既有測試全過**:`npm test`(config/utils/actions 不受影響)、`npx tsc --noEmit`、`npm run lint` 全綠。
2. **新增單元測試** `tests/unit/components/status-style.test.ts`:`statusStyle('draft'|'sent'|'accepted'|'rejected')` 回對應類別;未知值 fallback draft。
3. **視覺驗收(playwright,實機)**:淺/深各截一輪
   - `/zh-TW`(儀表板漸層卡)、`/zh-TW/quotes`(列表 + 狀態 pill)、`/zh-TW/quotes/new`(表單 + 漸層總計)、`/zh-TW/quotes/2`(詳細頁)
   - 切換鈕:切深色 → 重整 → 記住;切回淺色同理
   - **深色模式下 `/zh-TW/quotes/2` 的發票文件仍為白底**
   - PDF `/api/quotes/2/pdf` 仍 200 且版面正常
4. 響應式:手機寬度(375px)頂欄收合、表格可橫向捲動、sticky 表單按鈕正常。

## 實作分層(單一 spec,計畫分階段)

1. **設計系統 + 主題基礎**:globals.css tokens(淺/深)、ThemeProvider、ThemeToggle、button/card/badge 基礎 variant。→ 可先看到全站配色與深色切換。
2. **App Shell**:TopNav + 統一容器,移除各頁重複 header。
3. **儀表板**:漸層 StatCard + RecentQuotesTable。
4. **列表 + 狀態系統**:StatusBadge 統一、QuotesTable、空狀態、skeleton。
5. **表單**:卡片分區 + 漸層總計 + focus 樣式。
6. **詳細頁 / 列印 / PDF 精修**。
每階段結束 `tsc`+`lint`+`test` 綠、關鍵頁淺/深截圖驗收。

## 明確不做(YAGNI)

- 不改資料模型、不動 server actions 邏輯、不動金額/稅率計算。
- 不改 PDF 版面結構(只調色與對齊)。
- 不新增圖表庫(儀表板暫不加折線/長條圖;統計卡足夠)。若日後要,另開 spec。
- 不新增 UI 語言、不改 i18n key 結構(只增少量新字串如導覽、主題切換 aria-label)。
- 不做系統主題自動跟隨(`enableSystem={false}`;使用者明確切換)。
