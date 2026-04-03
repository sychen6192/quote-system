import { Quotation } from '../../../core/entities/quotation.entity';
import { PaginationParams, PaginatedResult, QueryOptions } from '../../../shared/types';

export interface QuotationRepository {
  // 基本 CRUD 操作
  findById(id: number, includeItems?: boolean): Promise<Quotation | null>;
  findAll(options?: QueryOptions): Promise<PaginatedResult<Quotation>>;
  create(quotation: Quotation): Promise<Quotation>;
  update(quotation: Quotation): Promise<Quotation>;
  delete(id: number): Promise<void>;

  // 查詢操作
  findByQuotationNumber(quotationNumber: string): Promise<Quotation | null>;
  findByCustomerId(customerId: number, options?: QueryOptions): Promise<PaginatedResult<Quotation>>;
  findBySalesperson(salesperson: string, options?: QueryOptions): Promise<PaginatedResult<Quotation>>;
  findByStatus(status: string, options?: QueryOptions): Promise<PaginatedResult<Quotation>>;

  // 搜尋操作
  search(query: string, options?: QueryOptions): Promise<PaginatedResult<Quotation>>;

  // 時間範圍查詢
  findCreatedBetween(startDate: Date, endDate: Date, options?: QueryOptions): Promise<PaginatedResult<Quotation>>;
  findValidBetween(startDate: Date, endDate: Date, options?: QueryOptions): Promise<PaginatedResult<Quotation>>;

  // 統計操作
  count(): Promise<number>;
  countByStatus(status: string): Promise<number>;
  countByCustomer(customerId: number): Promise<number>;
  countBySalesperson(salesperson: string): Promise<number>;

  // 財務統計
  getTotalAmountByStatus(status: string): Promise<number>;
  getTotalAmountByCustomer(customerId: number): Promise<number>;
  getTotalAmountBySalesperson(salesperson: string): Promise<number>;
  getTotalAmountByDateRange(startDate: Date, endDate: Date): Promise<number>;

  // 批量操作
  updateStatus(id: number, status: string): Promise<void>;
  updateMultipleStatus(ids: number[], status: string): Promise<void>;
}

// 查詢選項專用於報價
export interface QuotationQueryOptions extends QueryOptions {
  customerId?: number;
  salesperson?: string;
  status?: string;
  issuedAfter?: Date;
  issuedBefore?: Date;
  validAfter?: Date;
  validBefore?: Date;
  minTotalAmount?: number;
  maxTotalAmount?: number;
  includeItems?: boolean;
}