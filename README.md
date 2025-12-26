# Company Quotation System (公司報價管理系統)

這是一個基於 **Next.js 15 (App Router)** 建構的企業級報價單管理系統。本專案採用現代化的全端架構，強調**型別安全 (Type Safety)**、**資料一致性 (ACID)** 與 **極佳的使用者體驗 (UX)**。

## 🚀 Tech Stack (技術堆疊)

- **Core Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Actions)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (via Docker)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) (Type-safe SQL)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **Validation**: React Hook Form + Zod

## 🌟 Key Features (核心功能)

### 💼 Quotation Management (報價管理)

- **Dynamic Form**: 支援動態增減商品項目 (Field Array)，無需刷新頁面。
- **Real-time Calculation**: 前端即時計算小計、稅額與總金額 (Client-side Math)。
- **Financial Accuracy**: 金額在資料庫以 **Integer (分)** 儲存，杜絕浮點數誤差。

### ⚡ User Experience & Loading States (使用者體驗與載入優化)

- **Server Action Feedback**: 表單提交時自動觸發 `isPending` 載入狀態，防止重複提交並提供視覺回饋 (Loading Spinner/Pulse)。
- **Optimized Performance**: 利用 Next.js App Router 機制，實現伺服器端渲染 (SSR) 與串流傳輸 (Streaming)，加快首屏載入速度。
- **Instant Toast Notifications**: 操作成功或失敗時，即時彈出 Toast 訊息通知。

### 🛡️ Data Integrity (資料完整性)

- **Transactional Writes**: 使用 Database Transaction 確保報價單主檔與明細寫入的原子性 (All or Nothing)。
- **Unified Schema**: 使用 Zod 定義前後端共用的資料驗證規則 (Single Source of Truth)。

---

## 🛠️ Getting Started (快速開始)

### 1. Prerequisites (前置需求)

- Node.js 18+
- Docker & Docker Compose (用於執行 PostgreSQL)

### 2. Install Dependencies (安裝依賴)

這是執行專案與資料庫工具的必要步驟：

```bash
npm install
```

### 3.Environment Setup (環境設定)

請在專案根目錄建立 .env 檔案，供本機開發與 Drizzle Kit 使用：

# 複製並重新命名 .env.example -> .env

# 注意：本機連線請使用 localhost

```bash
DATABASE_URL="postgres://postgres:postgres@localhost:5432/quote-system"
```

### 4. Start Database (啟動資料庫)

使用 Docker 啟動 PostgreSQL 容器：

```bash
docker-compose up -d
```

### 5. Database Initialization (資料庫初始化)

重要：首次啟動或修改 Schema 後，務必執行此指令來建立/更新資料表：

```bash
npm run db:push
```

### 6. Run Development Server (啟動專案)

```bash
npm run dev
```

## 📂 Project Structure (專案結構)

quote-system/
├── actions/ # Server Actions (後端邏輯、DB 交易處理)
├── app/ # Next.js App Router (頁面與路由)
├── components/ # React 元件
│ ├── ui/ # shadcn/ui 基礎元件
│ └── quote-form.tsx # 包含 Loading 狀態處理的表單元件
├── db/ # 資料庫層 (Schema 定義)
├── lib/ # 共用工具 (Zod Schema, Utils)
└── public/ # 靜態資源

## Architecture Decisions (設計決策)

1. Money Handling: 前端顯示「元」，後端與 DB 儲存「分」。
2. Server Actions: 取代傳統 API Routes，獲得更好的型別推斷與開發體驗。
3. Zod Schema Sharing: 前端 Form Validation 與後端 Payload Validation 共用同一份定義。
