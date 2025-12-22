# Company Quotation System (公司報價管理系統)

這是一個基於 **Next.js 15 (App Router)** 建構的企業級報價單管理系統。本專案採用現代化的全端架構，強調**型別安全 (Type Safety)**、**資料一致性 (ACID)** 與 **高維護性**。

## 🚀 Tech Stack (技術堆疊)

- **Core Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Actions)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (via Docker)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) (Type-safe SQL)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **Form Management**: React Hook Form + Zod Validation

## 🌟 Key Features (核心功能)

- **Dynamic Quotation Form**: 支援動態增減商品項目，無需刷新頁面。
- **Real-time Calculation**: 前端即時計算小計、稅額與總金額，提供流暢使用者體驗。
- **Financial Accuracy**: 所有的金額欄位在資料庫中皆以 **Integer (最小單位：分)** 儲存，避免浮點數運算誤差。
- **Transactional Writes**: 使用 Database Transaction 確保報價單主檔與明細寫入的原子性 (All or Nothing)。
- **Schema Validation**: 使用 Zod 定義前後端共用的資料驗證規則。

## 🛠️ Getting Started (開發指南)

### 1. Prerequisites (前置需求)

- Node.js 18+
- Docker & Docker Compose (用於執行 PostgreSQL)

### 2. Environment Setup (環境設定)

複製 `.env.example` 並重新命名為 `.env`：

```bash
DATABASE_URL="postgres://postgres:password@localhost:5432/quote_db"
```

### 3. Database Initialization (資料庫啟動)

使用 Docker 啟動 PostgreSQL 容器：

```bash
docker-compose up -d
```

將 Schema 推送至資料庫 (Schema Migration)：

```bash
npm run db:push
# 或者直接執行: npx drizzle-kit push
```

### 4\. Run Development Server (啟動專案)

```bash
npm run dev
```

開啟瀏覽器訪問 [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000)。

---

## 📂 Project Structure (專案結構)

本專案採用「關注點分離」的架構設計：

```text
quote-system/
├── actions/             # Server Actions (後端邏輯、DB 交易處理)
├── app/                 # Next.js App Router (頁面與路由)
├── components/          # React 元件
│   ├── ui/              # shadcn/ui 基礎元件 (不含業務邏輯)
│   └── quote-form.tsx   # 業務邏輯元件 (含表單計算)
├── db/                  # 資料庫層
│   ├── schema.ts        # Drizzle 資料表定義
│   └── index.ts         # DB 連線設定
├── lib/                 # 共用工具
│   └── schemas/         # Zod 驗證定義 (前後端共用)
└── public/              # 靜態資源
```

## 💡 Architecture Decisions (設計決策)

### 1\. Money Handling (金額處理)

為了符合金融系統標準，我們**不使用 Float/Double** 儲存金額。

- **Frontend**: 使用者輸入 "元" (e.g., 100)。
- **Backend/DB**: 系統自動轉換並儲存為 "分" (e.g., 10000)。
- **Calculation**: 所有計算在轉換為整數後進行，顯示時再除以 100。

### 2\. Server Actions over API Routes

本專案不使用傳統 REST API (`pages/api`).
我們利用 Next.js **Server Actions** 直接在伺服器端處理表單提交。這帶來了更好的型別推斷，並減少了 Client/Server 之間的資料傳輸開銷。

### 3\. Zod Schema Sharing

`lib/schemas/quote.ts` 是唯一的真理來源 (Single Source of Truth)。
它同時被用於：

1.  **前端**: 表單即時驗證 (React Hook Form)。
2.  **後端**: API 接收資料前的安全性檢查。

---

## 📝 Commands Cheat Sheet (指令速查)

| 指令                                | 說明                                    |
| :---------------------------------- | :-------------------------------------- |
| `npx drizzle-kit push`              | 將 Schema 變更直接同步到資料庫 (開發用) |
| `npx drizzle-kit studio`            | 開啟 GUI 介面查看/管理資料庫內容        |
| `npx shadcn@latest add [component]` | 新增 UI 元件                            |
