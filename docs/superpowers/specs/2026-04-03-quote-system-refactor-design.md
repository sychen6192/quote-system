# Quote System 重構設計文件

**日期**: 2026-04-03
**作者**: Claude Sonnet 4.6
**專案**: 公司報價管理系統重構

## 概述

本文件描述報價管理系統的重構設計，目標是解決以下核心問題：
1. 程式碼難以維護和擴展
2. 型別安全性不足
3. 效能問題
4. 缺乏測試
5. 組件職責不明確，耦合度高

## 重構範圍

優先重構核心業務邏輯，包括：
- 報價管理（Quotations）
- 客戶管理（Customers）
- 報價項目管理（Quotation Items）

## 設計原則

### 1. 關注點分離（Separation of Concerns）
- **UI 層**: 純展示組件，無業務邏輯
- **業務邏輯層**: 處理業務規則和流程
- **資料訪問層**: 處理資料庫操作
- **基礎設施層**: 處理外部服務（郵件、PDF 等）

### 2. 單一職責原則（Single Responsibility Principle）
- 每個組件/函數只做一件事
- 組件大小控制在 150 行以內
- 函數大小控制在 30 行以內

### 3. 依賴注入（Dependency Injection）
- 避免硬編碼依賴
- 使用介面抽象依賴
- 方便測試和替換

### 4. 錯誤處理統一化
- 統一的錯誤處理策略
- 有意義的錯誤訊息
- 錯誤分類（業務錯誤、系統錯誤、驗證錯誤）

## 架構設計

### 新的目錄結構
```
quote-system/
├── app/                    # Next.js App Router
│   ├── [locale]/          # 多語言路由
│   │   ├── quotes/        # 報價相關頁面
│   │   └── customers/     # 客戶相關頁面
│   └── api/               # REST API (如有需要)
├── src/                   # 原始碼目錄（新增）
│   ├── core/             # 核心領域模型
│   │   ├── entities/     # 實體定義
│   │   ├── value-objects/# 值對象
│   │   └── errors/       # 領域錯誤
│   ├── application/      # 應用服務層
│   │   ├── use-cases/    # 用例實現
│   │   ├── dtos/         # 資料傳輸對象
│   │   └── services/     # 應用服務
│   ├── infrastructure/   # 基礎設施層
│   │   ├── database/     # 資料庫相關
│   │   ├── email/        # 郵件服務
│   │   ├── pdf/          # PDF 生成服務
│   │   └── cache/        # 快取服務
│   ├── presentation/     # 表現層
│   │   ├── components/   # React 組件
│   │   │   ├── ui/       # 基礎 UI 組件
│   │   │   ├── quotes/   # 報價相關組件
│   │   │   └── shared/   # 共享組件
│   │   ├── hooks/        # 自定義 Hooks
│   │   └── schemas/      # 表單驗證 Schema
│   └── shared/           # 共享程式碼
│       ├── types/        # TypeScript 型別定義
│       ├── utils/        # 工具函數
│       └── constants/    # 常數定義
├── tests/                # 測試目錄
│   ├── unit/            # 單元測試
│   ├── integration/     # 整合測試
│   └── e2e/             # 端到端測試
└── docs/                # 文件目錄
```

### 核心領域模型設計

#### 1. 客戶（Customer）實體
```typescript
// src/core/entities/customer.entity.ts
interface CustomerProps {
  id?: number;
  companyName: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  vatNumber?: string;
  email?: string;
  createdAt?: Date;
}

class Customer {
  private props: CustomerProps;
  
  constructor(props: CustomerProps) {
    this.validate(props);
    this.props = props;
  }
  
  private validate(props: CustomerProps): void {
    if (!props.companyName || props.companyName.trim().length === 0) {
      throw new Error('Company name is required');
    }
    if (props.email && !this.isValidEmail(props.email)) {
      throw new Error('Invalid email format');
    }
  }
  
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // Getters
  get id(): number | undefined { return this.props.id; }
  get companyName(): string { return this.props.companyName; }
  get contactPerson(): string | undefined { return this.props.contactPerson; }
  get email(): string | undefined { return this.props.email; }
  get createdAt(): Date | undefined { return this.props.createdAt; }
  
  // Business methods
  updateContactInfo(contactPerson?: string, phone?: string, email?: string): void {
    if (email && !this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }
    this.props.contactPerson = contactPerson;
    this.props.phone = phone;
    this.props.email = email;
  }
}
```

#### 2. 報價單（Quotation）實體
```typescript
// src/core/entities/quotation.entity.ts
interface QuotationProps {
  id?: number;
  quotationNumber: string;
  customerId?: number;
  salesperson: string;
  issuedDate: Date;
  validUntil: Date;
  shippingDate?: Date;
  paymentMethod?: string;
  shippingMethod?: string;
  subtotal: number; // 分
  taxRate: number;  // 基礎點 (500 = 5.00%)
  taxAmount: number; // 分
  otherFees: number; // 分
  totalAmount: number; // 分
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  notes?: string;
  createdAt?: Date;
  items?: QuotationItem[];
}

class Quotation {
  private props: QuotationProps;
  private items: QuotationItem[] = [];
  
  constructor(props: QuotationProps, items: QuotationItem[] = []) {
    this.validate(props);
    this.props = props;
    this.items = items;
    this.calculateTotals();
  }
  
  private validate(props: QuotationProps): void {
    if (!props.quotationNumber || props.quotationNumber.trim().length === 0) {
      throw new Error('Quotation number is required');
    }
    if (!props.salesperson || props.salesperson.trim().length === 0) {
      throw new Error('Salesperson is required');
    }
    if (props.validUntil < props.issuedDate) {
      throw new Error('Valid until date must be after issued date');
    }
    if (props.subtotal < 0 || props.taxAmount < 0 || props.totalAmount < 0) {
      throw new Error('Financial amounts cannot be negative');
    }
  }
  
  calculateTotals(): void {
    const subtotal = this.items.reduce((sum, item) => sum + item.calculateLineTotal(), 0);
    const taxableItems = this.items.filter(item => item.isTaxable);
    const taxableAmount = taxableItems.reduce((sum, item) => sum + item.calculateLineTotal(), 0);
    
    this.props.subtotal = subtotal;
    this.props.taxAmount = Math.round(taxableAmount * (this.props.taxRate / 10000)); // Convert basis points to percentage
    this.props.totalAmount = this.props.subtotal + this.props.taxAmount + (this.props.otherFees || 0);
  }
  
  markAsSent(): void {
    if (this.props.status === 'draft') {
      this.props.status = 'sent';
    } else {
      throw new Error(`Cannot mark as sent from status: ${this.props.status}`);
    }
  }
  
  addItem(item: QuotationItem): void {
    this.items.push(item);
    this.calculateTotals();
  }
  
  removeItem(itemId: number): void {
    this.items = this.items.filter(item => item.id !== itemId);
    this.calculateTotals();
  }
  
  // Getters
  get id(): number | undefined { return this.props.id; }
  get quotationNumber(): string { return this.props.quotationNumber; }
  get status(): string { return this.props.status; }
  get totalAmount(): number { return this.props.totalAmount; }
  get itemsList(): QuotationItem[] { return [...this.items]; }
}
```

#### 3. 報價項目（QuotationItem）實體
```typescript
// src/core/entities/quotation-item.entity.ts
interface QuotationItemProps {
  id?: number;
  quotationId?: number;
  productName: string;
  quantity: number;
  unitPrice: number; // 分
  isTaxable: boolean;
}

class QuotationItem {
  private props: QuotationItemProps;
  
  constructor(props: QuotationItemProps) {
    this.validate(props);
    this.props = props;
  }
  
  private validate(props: QuotationItemProps): void {
    if (!props.productName || props.productName.trim().length === 0) {
      throw new Error('Product name is required');
    }
    if (props.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    if (props.unitPrice < 0) {
      throw new Error('Unit price cannot be negative');
    }
  }
  
  calculateLineTotal(): number {
    return this.props.quantity * this.props.unitPrice;
  }
  
  // Getters
  get id(): number | undefined { return this.props.id; }
  get productName(): string { return this.props.productName; }
  get quantity(): number { return this.props.quantity; }
  get unitPrice(): number { return this.props.unitPrice; }
  get isTaxable(): boolean { return this.props.isTaxable; }
  
  // Business methods
  updateQuantity(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    this.props.quantity = quantity;
  }
  
  updatePrice(unitPrice: number): void {
    if (unitPrice < 0) {
      throw new Error('Unit price cannot be negative');
    }
    this.props.unitPrice = unitPrice;
  }
}
```

### 應用服務層設計

#### 1. 用例（Use Cases）
```typescript
// src/application/use-cases/create-quotation.use-case.ts
interface CreateQuotationCommand {
  customerId?: number;
  salesperson: string;
  validUntil: Date;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    isTaxable: boolean;
  }>;
  // ... 其他欄位
}

class CreateQuotationUseCase {
  constructor(
    private quotationRepository: QuotationRepository,
    private customerRepository: CustomerRepository,
    private idGenerator: IdGenerator
  ) {}
  
  async execute(command: CreateQuotationCommand): Promise<Quotation> {
    // 1. 驗證輸入
    this.validateCommand(command);
    
    // 2. 驗證客戶是否存在（如果提供了客戶ID）
    let customer: Customer | undefined;
    if (command.customerId) {
      customer = await this.customerRepository.findById(command.customerId);
      if (!customer) {
        throw new Error(`Customer with ID ${command.customerId} not found`);
      }
    }
    
    // 3. 產生報價單號
    const quotationNumber = await this.idGenerator.generateQuotationNumber();
    
    // 4. 建立報價項目實體
    const items = command.items.map(item => 
      new QuotationItem({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        isTaxable: item.isTaxable
      })
    );
    
    // 5. 建立報價單實體
    const quotation = new Quotation({
      quotationNumber,
      customerId: command.customerId,
      salesperson: command.salesperson,
      issuedDate: new Date(),
      validUntil: command.validUntil,
      subtotal: 0, // Will be calculated by entity
      taxRate: command.taxRate || 500, // Default 5%
      taxAmount: 0, // Will be calculated by entity
      otherFees: command.otherFees || 0,
      totalAmount: 0, // Will be calculated by entity
      status: 'draft',
      notes: command.notes,
      paymentMethod: command.paymentMethod,
      shippingMethod: command.shippingMethod,
      shippingDate: command.shippingDate
    }, items);
    
    // 6. 保存到資料庫
    const savedQuotation = await this.quotationRepository.create(quotation);
    
    // 7. 返回結果
    return savedQuotation;
  }
  
  private validateCommand(command: CreateQuotationCommand): void {
    if (!command.salesperson || command.salesperson.trim().length === 0) {
      throw new Error('Salesperson is required');
    }
    if (!command.validUntil) {
      throw new Error('Valid until date is required');
    }
    if (command.items.length === 0) {
      throw new Error('At least one item is required');
    }
    // 驗證項目資料
    command.items.forEach((item, index) => {
      if (!item.productName || item.productName.trim().length === 0) {
        throw new Error(`Item ${index + 1}: Product name is required`);
      }
      if (item.quantity <= 0) {
        throw new Error(`Item ${index + 1}: Quantity must be greater than 0`);
      }
      if (item.unitPrice < 0) {
        throw new Error(`Item ${index + 1}: Unit price cannot be negative`);
      }
    });
  }
}
```

#### 2. DTO（資料傳輸對象）
```typescript
// src/application/dtos/quotation.dto.ts
interface QuotationDTO {
  id: number;
  quotationNumber: string;
  customer?: CustomerDTO;
  salesperson: string;
  issuedDate: string; // ISO 字串
  validUntil: string; // ISO 字串
  subtotal: number; // 元
  taxAmount: number; // 元
  totalAmount: number; // 元
  status: string;
  // ... 其他欄位（轉換為前端需要的格式）
}

interface CreateQuotationRequest {
  customerId?: number;
  salesperson: string;
  validUntil: string; // ISO string
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number; // cents
    isTaxable: boolean;
  }>;
  taxRate?: number; // basis points (500 = 5%)
  otherFees?: number; // cents
  notes?: string;
  paymentMethod?: string;
  shippingMethod?: string;
  shippingDate?: string; // ISO string
}

interface UpdateQuotationRequest {
  id: number;
  customerId?: number;
  salesperson?: string;
  validUntil?: string; // ISO string
  items?: Array<{
    id?: number;
    productName: string;
    quantity: number;
    unitPrice: number; // cents
    isTaxable: boolean;
  }>;
  taxRate?: number; // basis points
  otherFees?: number; // cents
  notes?: string;
  paymentMethod?: string;
  shippingMethod?: string;
  shippingDate?: string; // ISO string
  status?: 'draft' | 'sent' | 'accepted' | 'rejected';
}
```

### 表現層設計

#### 1. 組件分類
- **智能組件（Smart Components）**: 包含業務邏輯、狀態管理
- **展示組件（Dumb Components）**: 純展示，通過 props 接收資料
- **容器組件（Container Components）**: 負責資料獲取和狀態管理

#### 2. 自定義 Hooks
```typescript
// src/presentation/hooks/use-quotations.ts
function useQuotations() {
  const queryClient = useQueryClient();
  
  // 獲取報價列表
  const { data, isLoading, error } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => fetchQuotations({ page: 1, pageSize: 10 }),
  });
  
  // 創建報價
  const createMutation = useMutation({
    mutationFn: (data: CreateQuotationRequest) => createQuotation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Quotation created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create quotation: ${error.message}`);
    },
  });
  
  // 更新報價
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateQuotationRequest }) => 
      updateQuotation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Quotation updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update quotation: ${error.message}`);
    },
  });
  
  // 刪除報價
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteQuotation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Quotation deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete quotation: ${error.message}`);
    },
  });
  
  return {
    quotations: data?.data || [],
    metadata: data?.metadata,
    isLoading,
    error,
    createQuotation: createMutation.mutate,
    updateQuotation: updateMutation.mutate,
    deleteQuotation: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['quotations'] }),
  };
}
```

#### 3. 表單處理
```typescript
// src/presentation/schemas/quotation.schema.ts
const quotationFormSchema = z.object({
  customerId: z.number().optional(),
  salesperson: z.string().min(1, 'Salesperson is required'),
  validUntil: z.string().min(1, 'Valid until date is required'),
  items: z.array(z.object({
    productName: z.string().min(1, 'Product name is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    unitPrice: z.number().min(0, 'Unit price cannot be negative'),
    isTaxable: z.boolean().default(true),
  })).min(1, 'At least one item is required'),
  taxRate: z.number().min(0).max(2000, 'Tax rate must be between 0% and 20%').default(500),
  otherFees: z.number().min(0).default(0),
  notes: z.string().optional(),
  paymentMethod: z.string().optional(),
  shippingMethod: z.string().optional(),
  shippingDate: z.string().optional(),
});

// 使用 react-hook-form + zod 進行表單驗證
```

### 基礎設施層設計

#### 1. 資料庫訪問
```typescript
// src/infrastructure/database/repositories/quotation.repository.ts
interface QuotationRepository {
  findById(id: number): Promise<Quotation | null>;
  findAll(options: FindAllOptions): Promise<Quotation[]>;
  create(quotation: Quotation): Promise<Quotation>;
  update(quotation: Quotation): Promise<Quotation>;
  delete(id: number): Promise<void>;
}

class DrizzleQuotationRepository implements QuotationRepository {
  // 使用 Drizzle ORM 實現
}
```

#### 2. 服務抽象
```typescript
// src/infrastructure/email/email.service.ts
interface EmailService {
  sendQuotationEmail(options: SendQuotationEmailOptions): Promise<void>;
}

class ResendEmailService implements EmailService {
  // 使用 Resend 實現
}
```

## 錯誤處理策略

### 錯誤分類
1. **領域錯誤（Domain Errors）**: 業務規則違反
2. **應用錯誤（Application Errors）**: 用例執行失敗
3. **基礎設施錯誤（Infrastructure Errors）**: 外部服務失敗
4. **驗證錯誤（Validation Errors）**: 輸入資料無效

### 錯誤處理中間件
```typescript
// src/shared/errors/error-handler.ts
class ErrorHandler {
  static handle(error: unknown): {
    message: string;
    code: string;
    statusCode: number;
  } {
    // 統一錯誤處理邏輯
  }
}
```

## 效能優化策略

### 1. 資料獲取優化
- 使用 Server Components 進行伺服器端渲染
- 實現資料分頁和懶載入
- 使用 React Query 進行客戶端狀態管理

### 2. 打包優化
- 代碼分割（Code Splitting）
- 動態導入（Dynamic Imports）
- 樹搖（Tree Shaking）

### 3. 快取策略
- 資料庫查詢快取
- API 回應快取
- 客戶端狀態快取

## 測試策略

### 1. 單元測試
- 測試領域實體的業務邏輯
- 測試工具函數
- 測試自定義 Hooks

### 2. 整合測試
- 測試應用服務層
- 測試資料庫操作
- 測試 API 端點

### 3. 端到端測試
- 測試完整使用者流程
- 測試關鍵業務場景

## 遷移策略

### 階段一：建立基礎架構（1-2 週）
1. 建立新的目錄結構
2. 實現核心領域模型
3. 建立錯誤處理機制
4. 設定測試環境

### 階段二：重構報價管理（2-3 週）
1. 重構報價實體和業務邏輯
2. 實現新的應用服務
3. 重構報價相關組件
4. 編寫測試

### 階段三：重構客戶管理（1-2 週）
1. 重構客戶實體和業務邏輯
2. 實現客戶相關服務
3. 重構客戶相關組件

### 階段四：優化和測試（1-2 週）
1. 效能優化
2. 增加測試覆蓋率
3. 文件撰寫
4. 部署驗證

## 成功指標

### 技術指標
1. 組件耦合度降低 50% 以上
2. 型別覆蓋率達到 95% 以上
3. 測試覆蓋率達到 80% 以上
4. 主要頁面載入時間減少 30% 以上

### 業務指標
1. 新功能開發速度提升 40% 以上
2. 程式碼審查時間減少 50% 以上
3. 生產環境錯誤減少 70% 以上

## 風險與緩解

### 風險 1：重構期間影響現有功能
**緩解**: 
- 逐步遷移，保持向後兼容
- 充分的測試覆蓋
- 功能旗標（Feature Flags）

### 風險 2：團隊學習曲線
**緩解**:
- 詳細的文件
- 代碼審查和配對編程
- 培訓會議

### 風險 3：時間和資源不足
**緩解**:
- 優先處理高價值功能
- 分階段實施
- 定期評估進度

## 結論

本次重構將從根本上改善系統的維護性、擴展性和可靠性。通過清晰的架構分層、嚴格的型別檢查和全面的測試覆蓋，我們將建立一個現代化、可維護的報價管理系統。

建議從階段一開始，逐步推進重構工作，確保每個階段都有明確的交付物和驗收標準。