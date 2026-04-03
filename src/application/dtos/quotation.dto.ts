import { QuotationStatus } from '../../../shared/constants';
import { DateUtils, MoneyUtils } from '../../shared/utils';

// 基本 DTO 介面
export interface BaseDTO {
  id?: number;
  createdAt?: string;
  updatedAt?: string;
}

// 客戶 DTO
export interface CustomerDTO extends BaseDTO {
  companyName: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  vatNumber?: string;
  email?: string;
}

// 報價項目 DTO
export interface QuotationItemDTO {
  id?: number;
  productName: string;
  quantity: number;
  unitPrice: number; // cents
  unitPriceFormatted?: string; // formatted for display
  isTaxable: boolean;
  lineTotal?: number; // cents
  lineTotalFormatted?: string; // formatted for display
}

// 報價 DTO
export interface QuotationDTO extends BaseDTO {
  quotationNumber: string;
  customerId?: number;
  customer?: CustomerDTO;
  salesperson: string;
  issuedDate: string; // ISO string
  validUntil: string; // ISO string
  shippingDate?: string; // ISO string
  paymentMethod?: string;
  shippingMethod?: string;
  subtotal: number; // cents
  subtotalFormatted?: string; // formatted for display
  taxRate: number; // basis points
  taxAmount: number; // cents
  taxAmountFormatted?: string; // formatted for display
  otherFees: number; // cents
  otherFeesFormatted?: string; // formatted for display
  totalAmount: number; // cents
  totalAmountFormatted?: string; // formatted for display
  status: QuotationStatus;
  notes?: string;
  items: QuotationItemDTO[];
}

// 創建報價請求 DTO
export interface CreateQuotationRequest {
  customerId?: number;
  salesperson: string;
  validUntil: string; // ISO string
  items: CreateQuotationItemRequest[];
  taxRate?: number; // basis points (default: 500 = 5%)
  otherFees?: number; // cents
  notes?: string;
  paymentMethod?: string;
  shippingMethod?: string;
  shippingDate?: string; // ISO string
}

export interface CreateQuotationItemRequest {
  productName: string;
  quantity: number;
  unitPrice: number; // cents
  isTaxable: boolean;
}

// 更新報價請求 DTO
export interface UpdateQuotationRequest {
  id: number;
  customerId?: number;
  salesperson?: string;
  validUntil?: string; // ISO string
  items?: UpdateQuotationItemRequest[];
  taxRate?: number; // basis points
  otherFees?: number; // cents
  notes?: string;
  paymentMethod?: string;
  shippingMethod?: string;
  shippingDate?: string; // ISO string
  status?: QuotationStatus;
}

export interface UpdateQuotationItemRequest {
  id?: number;
  productName: string;
  quantity: number;
  unitPrice: number; // cents
  isTaxable: boolean;
}

// 查詢報價請求 DTO
export interface QueryQuotationsRequest {
  page?: number;
  pageSize?: number;
  customerId?: number;
  salesperson?: string;
  status?: QuotationStatus;
  issuedAfter?: string; // ISO string
  issuedBefore?: string; // ISO string
  validAfter?: string; // ISO string
  validBefore?: string; // ISO string
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

// 報價統計 DTO
export interface QuotationStatsDTO {
  totalCount: number;
  totalAmount: number; // cents
  totalAmountFormatted?: string;
  draftCount: number;
  sentCount: number;
  acceptedCount: number;
  rejectedCount: number;
  byCustomer: Array<{
    customerId: number;
    customerName: string;
    count: number;
    totalAmount: number;
  }>;
  bySalesperson: Array<{
    salesperson: string;
    count: number;
    totalAmount: number;
  }>;
  byMonth: Array<{
    month: string; // YYYY-MM
    count: number;
    totalAmount: number;
  }>;
}

// DTO 轉換器
export class QuotationDTOConverter {
  static toDTO(quotation: any, includeCustomer: boolean = true): QuotationDTO {
    const dto: QuotationDTO = {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      customerId: quotation.customerId,
      salesperson: quotation.salesperson,
      issuedDate: quotation.issuedDate.toISOString(),
      validUntil: quotation.validUntil.toISOString(),
      shippingDate: quotation.shippingDate?.toISOString(),
      paymentMethod: quotation.paymentMethod,
      shippingMethod: quotation.shippingMethod,
      subtotal: quotation.subtotal,
      subtotalFormatted: MoneyUtils.formatCents(quotation.subtotal),
      taxRate: quotation.taxRate,
      taxAmount: quotation.taxAmount,
      taxAmountFormatted: MoneyUtils.formatCents(quotation.taxAmount),
      otherFees: quotation.otherFees,
      otherFeesFormatted: MoneyUtils.formatCents(quotation.otherFees),
      totalAmount: quotation.totalAmount,
      totalAmountFormatted: MoneyUtils.formatCents(quotation.totalAmount),
      status: quotation.status,
      notes: quotation.notes,
      createdAt: quotation.createdAt?.toISOString(),
      items: [],
    };

    if (includeCustomer && quotation.customer) {
      dto.customer = {
        id: quotation.customer.id,
        companyName: quotation.customer.companyName,
        contactPerson: quotation.customer.contactPerson,
        phone: quotation.customer.phone,
        address: quotation.customer.address,
        vatNumber: quotation.customer.vatNumber,
        email: quotation.customer.email,
        createdAt: quotation.customer.createdAt?.toISOString(),
      };
    }

    if (quotation.items) {
      dto.items = quotation.items.map((item: any) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitPriceFormatted: MoneyUtils.formatCents(item.unitPrice),
        isTaxable: item.isTaxable,
        lineTotal: item.quantity * item.unitPrice,
        lineTotalFormatted: MoneyUtils.formatCents(item.quantity * item.unitPrice),
      }));
    }

    return dto;
  }

  static fromCreateRequest(request: CreateQuotationRequest): any {
    return {
      customerId: request.customerId,
      salesperson: request.salesperson,
      validUntil: new Date(request.validUntil),
      items: request.items.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        isTaxable: item.isTaxable,
      })),
      taxRate: request.taxRate || 500,
      otherFees: request.otherFees || 0,
      notes: request.notes,
      paymentMethod: request.paymentMethod,
      shippingMethod: request.shippingMethod,
      shippingDate: request.shippingDate ? new Date(request.shippingDate) : undefined,
    };
  }

  static fromUpdateRequest(request: UpdateQuotationRequest): any {
    const updateData: any = {
      id: request.id,
    };

    if (request.customerId !== undefined) updateData.customerId = request.customerId;
    if (request.salesperson !== undefined) updateData.salesperson = request.salesperson;
    if (request.validUntil !== undefined) updateData.validUntil = new Date(request.validUntil);
    if (request.taxRate !== undefined) updateData.taxRate = request.taxRate;
    if (request.otherFees !== undefined) updateData.otherFees = request.otherFees;
    if (request.notes !== undefined) updateData.notes = request.notes;
    if (request.paymentMethod !== undefined) updateData.paymentMethod = request.paymentMethod;
    if (request.shippingMethod !== undefined) updateData.shippingMethod = request.shippingMethod;
    if (request.shippingDate !== undefined) updateData.shippingDate = new Date(request.shippingDate);
    if (request.status !== undefined) updateData.status = request.status;

    if (request.items !== undefined) {
      updateData.items = request.items.map(item => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        isTaxable: item.isTaxable,
      }));
    }

    return updateData;
  }

  static toPaginatedResponse(
    data: any[],
    total: number,
    page: number,
    pageSize: number,
    includeCustomer: boolean = true
  ): { data: QuotationDTO[]; metadata: any } {
    return {
      data: data.map(item => this.toDTO(item, includeCustomer)),
      metadata: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page < Math.ceil(total / pageSize),
        hasPreviousPage: page > 1,
      },
    };
  }

  static toStatsDTO(stats: any): QuotationStatsDTO {
    return {
      totalCount: stats.totalCount,
      totalAmount: stats.totalAmount,
      totalAmountFormatted: MoneyUtils.formatCents(stats.totalAmount),
      draftCount: stats.draftCount,
      sentCount: stats.sentCount,
      acceptedCount: stats.acceptedCount,
      rejectedCount: stats.rejectedCount,
      byCustomer: stats.byCustomer?.map((item: any) => ({
        customerId: item.customerId,
        customerName: item.customerName,
        count: item.count,
        totalAmount: item.totalAmount,
      })) || [],
      bySalesperson: stats.bySalesperson?.map((item: any) => ({
        salesperson: item.salesperson,
        count: item.count,
        totalAmount: item.totalAmount,
      })) || [],
      byMonth: stats.byMonth?.map((item: any) => ({
        month: item.month,
        count: item.count,
        totalAmount: item.totalAmount,
      })) || [],
    };
  }
}