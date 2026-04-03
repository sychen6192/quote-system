import { Customer } from '../../../core/entities/customer.entity';
import { PaginationParams, PaginatedResult, QueryOptions } from '../../../shared/types';

export interface CustomerRepository {
  // 基本 CRUD 操作
  findById(id: number): Promise<Customer | null>;
  findAll(options?: QueryOptions): Promise<PaginatedResult<Customer>>;
  create(customer: Customer): Promise<Customer>;
  update(customer: Customer): Promise<Customer>;
  delete(id: number): Promise<void>;

  // 查詢操作
  findByCompanyName(companyName: string): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  findByVATNumber(vatNumber: string): Promise<Customer | null>;

  // 搜尋操作
  search(query: string, options?: QueryOptions): Promise<PaginatedResult<Customer>>;

  // 統計操作
  count(): Promise<number>;
  countByStatus?(status: string): Promise<number>; // 可選方法，用於擴展
}

// 查詢選項專用於客戶
export interface CustomerQueryOptions extends QueryOptions {
  companyName?: string;
  contactPerson?: string;
  email?: string;
  vatNumber?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}