// 應用常數

// 預設分頁設定
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;

// 預設稅率（基礎點：500 = 5%）
export const DEFAULT_TAX_RATE = 500; // 5%

// 貨幣設定
export const DEFAULT_CURRENCY = 'TWD';
export const CURRENCY_SYMBOLS: Record<string, string> = {
  TWD: 'NT$',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  CNY: '¥',
};

// 日期格式
export const DATE_FORMATS = {
  SHORT: 'yyyy-MM-dd',
  LONG: 'yyyy-MM-dd HH:mm:ss',
  DISPLAY: 'yyyy/MM/dd',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
};

// 報價狀態
export const QUOTATION_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
} as const;

export type QuotationStatus = typeof QUOTATION_STATUS[keyof typeof QUOTATION_STATUS];

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  [QUOTATION_STATUS.DRAFT]: '草稿',
  [QUOTATION_STATUS.SENT]: '已發送',
  [QUOTATION_STATUS.ACCEPTED]: '已接受',
  [QUOTATION_STATUS.REJECTED]: '已拒絕',
};

export const QUOTATION_STATUS_COLORS: Record<QuotationStatus, string> = {
  [QUOTATION_STATUS.DRAFT]: 'gray',
  [QUOTATION_STATUS.SENT]: 'blue',
  [QUOTATION_STATUS.ACCEPTED]: 'green',
  [QUOTATION_STATUS.REJECTED]: 'red',
};

// 付款方式
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CREDIT_CARD: 'credit_card',
  BANK_TRANSFER: 'bank_transfer',
  CHECK: 'check',
  OTHER: 'other',
} as const;

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PAYMENT_METHODS.CASH]: '現金',
  [PAYMENT_METHODS.CREDIT_CARD]: '信用卡',
  [PAYMENT_METHODS.BANK_TRANSFER]: '銀行轉帳',
  [PAYMENT_METHODS.CHECK]: '支票',
  [PAYMENT_METHODS.OTHER]: '其他',
};

// 運送方式
export const SHIPPING_METHODS = {
  PICKUP: 'pickup',
  DELIVERY: 'delivery',
  EXPRESS: 'express',
  INTERNATIONAL: 'international',
} as const;

export type ShippingMethod = typeof SHIPPING_METHODS[keyof typeof SHIPPING_METHODS];

export const SHIPPING_METHOD_LABELS: Record<ShippingMethod, string> = {
  [SHIPPING_METHODS.PICKUP]: '自取',
  [SHIPPING_METHODS.DELIVERY]: '配送',
  [SHIPPING_METHODS.EXPRESS]: '快遞',
  [SHIPPING_METHODS.INTERNATIONAL]: '國際運送',
};

// 錯誤代碼
export const ERROR_CODES = {
  // 驗證錯誤
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PHONE: 'INVALID_PHONE',
  INVALID_VAT_NUMBER: 'INVALID_VAT_NUMBER',

  // 業務錯誤
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  QUOTATION_EXPIRED: 'QUOTATION_EXPIRED',

  // 資料庫錯誤
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  FOREIGN_KEY_CONSTRAINT: 'FOREIGN_KEY_CONSTRAINT',

  // 系統錯誤
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// API 路徑前綴
export const API_PREFIXES = {
  V1: '/api/v1',
  INTERNAL: '/api/internal',
  PUBLIC: '/api/public',
};

// 快取設定
export const CACHE_TTL = {
  SHORT: 60, // 60 seconds
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
};

// 檔案大小限制（位元組）
export const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  PDF: 20 * 1024 * 1024, // 20MB
};

// 支援的檔案類型
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  SPREADSHEETS: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

// 預設有效天數
export const DEFAULT_VALID_DAYS = 30;

// 報價單號碼前綴
export const QUOTATION_NUMBER_PREFIX = 'QT';

// 本地儲存鍵值
export const LOCAL_STORAGE_KEYS = {
  USER_PREFERENCES: 'user_preferences',
  RECENT_SEARCHES: 'recent_searches',
  CART: 'cart',
  AUTH_TOKEN: 'auth_token',
};

// 顏色主題
export const THEME_COLORS = {
  PRIMARY: '#2563eb',
  SECONDARY: '#7c3aed',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',
};

// 響應式斷點
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  XXL: 1536,
};

// 表單驗證規則
export const VALIDATION_RULES = {
  EMAIL_MAX_LENGTH: 255,
  PHONE_MAX_LENGTH: 20,
  NAME_MAX_LENGTH: 100,
  ADDRESS_MAX_LENGTH: 500,
  NOTES_MAX_LENGTH: 2000,
  PRODUCT_NAME_MAX_LENGTH: 200,
  QUANTITY_MIN: 1,
  QUANTITY_MAX: 999999,
  UNIT_PRICE_MIN: 0,
  UNIT_PRICE_MAX: 99999999,
};

// 匯出選項
export const EXPORT_OPTIONS = {
  CSV: { label: 'CSV', value: 'csv' },
  EXCEL: { label: 'Excel', value: 'excel' },
  PDF: { label: 'PDF', value: 'pdf' },
  JSON: { label: 'JSON', value: 'json' },
};