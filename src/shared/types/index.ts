// 通用類型定義

// 金額類型（以分為單位）
export type AmountInCents = number;

// 稅率類型（以基礎點為單位，500 = 5.00%）
export type TaxRateInBasisPoints = number;

// 分頁參數
export interface PaginationParams {
  page: number;
  pageSize: number;
}

// 分頁結果
export interface PaginatedResult<T> {
  data: T[];
  metadata: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// 排序選項
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// 過濾選項
export interface FilterOptions {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
  value: any;
}

// API 回應標準格式
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

// 貨幣格式化選項
export interface CurrencyFormatOptions {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

// 日期範圍
export interface DateRange {
  from: Date;
  to: Date;
}

// 查詢選項
export interface QueryOptions {
  pagination?: PaginationParams;
  sort?: SortOptions[];
  filters?: FilterOptions[];
  search?: string;
}

// 檔案上傳選項
export interface FileUploadOptions {
  maxSize?: number; // bytes
  allowedTypes?: string[];
  maxFiles?: number;
}

// 匯出選項
export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf' | 'json';
  includeFields?: string[];
  filename?: string;
}