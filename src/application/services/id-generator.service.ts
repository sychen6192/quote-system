import { QuotationRepository } from '../../infrastructure/database/repositories/quotation.repository';
import { DatabaseError } from '../../shared/errors/error-handler';
import { QUOTATION_NUMBER_PREFIX } from '../../shared/constants';

export interface IdGenerator {
  generateQuotationNumber(): Promise<string>;
  generateCustomerNumber?(): Promise<string>;
  generateInvoiceNumber?(): Promise<string>;
}

export class SequentialIdGenerator implements IdGenerator {
  constructor(private quotationRepository: QuotationRepository) {}

  async generateQuotationNumber(): Promise<string> {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const prefix = `${QUOTATION_NUMBER_PREFIX}-${year}${month}${day}`;

      // 取得當天最新的報價單號
      const latestQuotations = await this.quotationRepository.findAll({
        filters: [
          {
            field: 'quotationNumber',
            operator: 'contains',
            value: prefix,
          },
        ],
        sort: [
          {
            field: 'quotationNumber',
            direction: 'desc',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 1,
        },
      });

      let nextSequence = 1;

      if (latestQuotations.data.length > 0) {
        const latestNumber = latestQuotations.data[0].quotationNumber;
        const sequencePart = latestNumber.split('-').pop();

        if (sequencePart && /^\d+$/.test(sequencePart)) {
          nextSequence = parseInt(sequencePart, 10) + 1;
        }
      }

      // 格式化序列號為三位數
      const sequenceFormatted = String(nextSequence).padStart(3, '0');
      return `${prefix}-${sequenceFormatted}`;
    } catch (error) {
      console.error('Failed to generate quotation number:', error);
      throw new DatabaseError('Failed to generate quotation number', {
        originalError: error,
      });
    }
  }

  async generateCustomerNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `CUST-${year}${month}`;

    // 這裡可以實現客戶編號生成邏輯
    // 暫時返回一個隨機編號
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${randomPart}`;
  }

  async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}`;

    // 這裡可以實現發票編號生成邏輯
    // 暫時返回一個隨機編號
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${randomPart}`;
  }
}

// 簡單的 ID 生成器（用於測試或開發環境）
export class SimpleIdGenerator implements IdGenerator {
  private counter: number = 1;

  async generateQuotationNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const sequence = String(this.counter++).padStart(3, '0');
    return `${QUOTATION_NUMBER_PREFIX}-${year}${month}${day}-${sequence}`;
  }
}

// UUID 生成器
export class UuidIdGenerator implements IdGenerator {
  async generateQuotationNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    // 生成 UUID 的部分
    const uuidPart = this.generateUUID().substring(0, 8).toUpperCase();
    return `${QUOTATION_NUMBER_PREFIX}-${year}${month}${day}-${uuidPart}`;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// ID 生成器工廠
export class IdGeneratorFactory {
  static create(type: 'sequential' | 'simple' | 'uuid', repository?: QuotationRepository): IdGenerator {
    switch (type) {
      case 'sequential':
        if (!repository) {
          throw new Error('Repository is required for sequential ID generator');
        }
        return new SequentialIdGenerator(repository);

      case 'simple':
        return new SimpleIdGenerator();

      case 'uuid':
        return new UuidIdGenerator();

      default:
        throw new Error(`Unknown ID generator type: ${type}`);
    }
  }

  static createDefault(repository: QuotationRepository): IdGenerator {
    return this.create('sequential', repository);
  }
}

// 全域 ID 生成器實例
let globalIdGenerator: IdGenerator | null = null;

export function getIdGenerator(repository?: QuotationRepository): IdGenerator {
  if (!globalIdGenerator) {
    if (!repository) {
      throw new Error('Repository is required to create ID generator');
    }
    globalIdGenerator = IdGeneratorFactory.createDefault(repository);
  }
  return globalIdGenerator;
}

export function setGlobalIdGenerator(generator: IdGenerator): void {
  globalIdGenerator = generator;
}

// 測試輔助函數
export class IdGeneratorTestHelper {
  static async testGenerator(generator: IdGenerator, count: number = 5): Promise<string[]> {
    const results: string[] = [];

    for (let i = 0; i < count; i++) {
      const id = await generator.generateQuotationNumber();
      results.push(id);

      // 驗證格式
      if (!this.isValidQuotationNumber(id)) {
        throw new Error(`Invalid quotation number format: ${id}`);
      }
    }

    return results;
  }

  static isValidQuotationNumber(number: string): boolean {
    const pattern = /^QT-\d{8}-\d{3}$/; // QT-YYYYMMDD-001
    return pattern.test(number);
  }

  static extractDateFromNumber(number: string): Date | null {
    const match = number.match(/^QT-(\d{4})(\d{2})(\d{2})-\d{3}$/);

    if (!match) {
      return null;
    }

    const [, year, month, day] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  static extractSequenceFromNumber(number: string): number | null {
    const match = number.match(/^QT-\d{8}-(\d{3})$/);

    if (!match) {
      return null;
    }

    return parseInt(match[1], 10);
  }
}