import { Quotation } from '../../core/entities/quotation.entity';
import { QuotationItem } from '../../core/entities/quotation-item.entity';
import { CustomerRepository } from '../../infrastructure/database/repositories/customer.repository';
import { QuotationRepository } from '../../infrastructure/database/repositories/quotation.repository';
import { ValidationError, NotFoundError, BusinessError } from '../../shared/errors/error-handler';
import { ERROR_CODES } from '../../shared/constants';
import { DateUtils, ValidationUtils } from '../../shared/utils';
import { IdGenerator } from '../services/id-generator.service';

export interface CreateQuotationCommand {
  customerId?: number;
  salesperson: string;
  validUntil: Date;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number; // cents
    isTaxable: boolean;
  }>;
  taxRate?: number; // basis points (default: 500 = 5%)
  otherFees?: number; // cents
  notes?: string;
  paymentMethod?: string;
  shippingMethod?: string;
  shippingDate?: Date;
}

export interface CreateQuotationResult {
  quotation: Quotation;
  quotationNumber: string;
  totalAmount: number; // cents
  totalAmountFormatted?: string;
}

export class CreateQuotationUseCase {
  constructor(
    private quotationRepository: QuotationRepository,
    private customerRepository: CustomerRepository,
    private idGenerator: IdGenerator
  ) {}

  async execute(command: CreateQuotationCommand): Promise<CreateQuotationResult> {
    // 1. 驗證輸入
    this.validateCommand(command);

    // 2. 驗證客戶是否存在（如果提供了客戶ID）
    if (command.customerId) {
      const customer = await this.customerRepository.findById(command.customerId);
      if (!customer) {
        throw new NotFoundError('Customer', command.customerId);
      }
    }

    // 3. 產生報價單號
    const quotationNumber = await this.idGenerator.generateQuotationNumber();

    // 4. 建立報價項目實體
    const quotationItems = command.items.map(item =>
      new QuotationItem({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        isTaxable: item.isTaxable,
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
      shippingDate: command.shippingDate,
    }, quotationItems);

    // 6. 保存到資料庫
    const savedQuotation = await this.quotationRepository.create(quotation);

    // 7. 返回結果
    return {
      quotation: savedQuotation,
      quotationNumber: savedQuotation.quotationNumber,
      totalAmount: savedQuotation.totalAmount,
    };
  }

  private validateCommand(command: CreateQuotationCommand): void {
    const errors: string[] = [];

    // 驗證必要欄位
    if (!command.salesperson || command.salesperson.trim().length === 0) {
      errors.push('Salesperson is required');
    }

    if (!command.validUntil) {
      errors.push('Valid until date is required');
    } else if (command.validUntil < new Date()) {
      errors.push('Valid until date must be in the future');
    }

    // 驗證項目
    if (!command.items || command.items.length === 0) {
      errors.push('At least one item is required');
    } else {
      command.items.forEach((item, index) => {
        if (!item.productName || item.productName.trim().length === 0) {
          errors.push(`Item ${index + 1}: Product name is required`);
        }
        if (!ValidationUtils.isPositiveInteger(item.quantity)) {
          errors.push(`Item ${index + 1}: Quantity must be a positive integer`);
        }
        if (item.unitPrice < 0) {
          errors.push(`Item ${index + 1}: Unit price cannot be negative`);
        }
      });
    }

    // 驗證稅率
    if (command.taxRate !== undefined) {
      if (!ValidationUtils.isInRange(command.taxRate, 0, 2000)) {
        errors.push('Tax rate must be between 0% and 20%');
      }
    }

    // 驗證其他費用
    if (command.otherFees !== undefined && command.otherFees < 0) {
      errors.push('Other fees cannot be negative');
    }

    // 驗證運送日期
    if (command.shippingDate && command.shippingDate < new Date()) {
      errors.push('Shipping date must be in the future or today');
    }

    // 如果有錯誤，拋出驗證異常
    if (errors.length > 0) {
      throw new ValidationError('Validation failed', {
        errors,
        fieldErrors: this.extractFieldErrors(errors),
      });
    }
  }

  private extractFieldErrors(errors: string[]): Record<string, string[]> {
    const fieldErrors: Record<string, string[]> = {};

    errors.forEach(error => {
      // 嘗試從錯誤訊息中提取欄位名稱
      const match = error.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, field, message] = match;
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push(message);
      } else {
        // 如果無法提取，將錯誤放在 general 欄位
        if (!fieldErrors.general) {
          fieldErrors.general = [];
        }
        fieldErrors.general.push(error);
      }
    });

    return fieldErrors;
  }

  // 批量創建報價（可選功能）
  async executeBatch(commands: CreateQuotationCommand[]): Promise<CreateQuotationResult[]> {
    const results: CreateQuotationResult[] = [];

    for (const command of commands) {
      try {
        const result = await this.execute(command);
        results.push(result);
      } catch (error) {
        // 記錄錯誤但繼續處理其他命令
        console.error(`Failed to create quotation:`, error);
        // 可以選擇性地將失敗的結果添加到輸出中
        results.push({
          quotation: null as any,
          quotationNumber: 'FAILED',
          totalAmount: 0,
        });
      }
    }

    return results;
  }

  // 驗證命令但不執行（用於預覽）
  async validateOnly(command: CreateQuotationCommand): Promise<{
    isValid: boolean;
    errors: string[];
    fieldErrors: Record<string, string[]>;
    preview?: {
      subtotal: number;
      taxAmount: number;
      totalAmount: number;
      validUntil: Date;
      itemCount: number;
    };
  }> {
    try {
      this.validateCommand(command);

      // 計算預覽
      const subtotal = command.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const taxableItems = command.items.filter(item => item.isTaxable);
      const taxableAmount = taxableItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const taxRate = command.taxRate || 500;
      const taxAmount = Math.round(taxableAmount * (taxRate / 10000));
      const otherFees = command.otherFees || 0;
      const totalAmount = subtotal + taxAmount + otherFees;

      return {
        isValid: true,
        errors: [],
        fieldErrors: {},
        preview: {
          subtotal,
          taxAmount,
          totalAmount,
          validUntil: command.validUntil,
          itemCount: command.items.length,
        },
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          isValid: false,
          errors: error.details?.errors || [error.message],
          fieldErrors: error.details?.fieldErrors || {},
        };
      }
      throw error;
    }
  }
}