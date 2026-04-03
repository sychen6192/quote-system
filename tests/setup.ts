// 測試環境設置

// 設置環境變數
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test_quote_system';

// 全局測試輔助函數
global.beforeEach(() => {
  // 每個測試前的設置
  jest.clearAllMocks();
});

global.afterEach(() => {
  // 每個測試後的清理
});

global.beforeAll(() => {
  // 所有測試前的設置
});

global.afterAll(() => {
  // 所有測試後的清理
});

// 擴展 Jest 的 expect
expect.extend({
  toBeValidQuotationNumber(received: string) {
    const pattern = /^QT-\d{8}-\d{3}$/;
    const pass = pattern.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid quotation number`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid quotation number (format: QT-YYYYMMDD-001)`,
        pass: false,
      };
    }
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email address`,
        pass: false,
      };
    }
  },

  toBePositiveAmount(received: number) {
    const pass = received >= 0;

    if (pass) {
      return {
        message: () => `expected ${received} not to be a positive amount`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a positive amount (>= 0)`,
        pass: false,
      };
    }
  },

  toThrowValidationError(received: Function, field?: string) {
    try {
      received();
      return {
        message: () => `expected function to throw a validation error`,
        pass: false,
      };
    } catch (error: any) {
      const isValidationError = error.name === 'ValidationError';
      const hasCorrectField = !field || (error.details?.field === field);

      if (isValidationError && hasCorrectField) {
        return {
          message: () => `expected function not to throw a validation error for field ${field}`,
          pass: true,
        };
      } else {
        return {
          message: () => `expected function to throw a validation error${field ? ` for field ${field}` : ''}, but got ${error.name}: ${error.message}`,
          pass: false,
        };
      }
    }
  },
});

// 聲明全局擴展
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidQuotationNumber(): R;
      toBeValidEmail(): R;
      toBePositiveAmount(): R;
      toThrowValidationError(field?: string): R;
    }
  }
}

// 測試輔助函數
export const testHelpers = {
  createMockCustomer: (overrides = {}) => ({
    id: 1,
    companyName: 'Test Company',
    contactPerson: 'John Doe',
    email: 'john@test.com',
    phone: '1234567890',
    address: 'Test Address',
    vatNumber: '12345678',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }),

  createMockQuotation: (overrides = {}) => ({
    id: 1,
    quotationNumber: 'QT-20240101-001',
    customerId: 1,
    salesperson: 'Sales Person',
    issuedDate: new Date('2024-01-01'),
    validUntil: new Date('2024-01-31'),
    subtotal: 10000, // 100.00 in cents
    taxRate: 500, // 5%
    taxAmount: 500, // 5.00 in cents
    otherFees: 0,
    totalAmount: 10500, // 105.00 in cents
    status: 'draft',
    notes: 'Test notes',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }),

  createMockQuotationItem: (overrides = {}) => ({
    id: 1,
    quotationId: 1,
    productName: 'Test Product',
    quantity: 2,
    unitPrice: 5000, // 50.00 in cents
    isTaxable: true,
    ...overrides,
  }),

  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  mockConsole: () => {
    const originalConsole = { ...console };

    beforeEach(() => {
      console.log = jest.fn();
      console.error = jest.fn();
      console.warn = jest.fn();
      console.info = jest.fn();
    });

    afterEach(() => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    });

    return {
      getLogs: () => (console.log as jest.Mock).mock.calls,
      getErrors: () => (console.error as jest.Mock).mock.calls,
      getWarnings: () => (console.warn as jest.Mock).mock.calls,
      getInfos: () => (console.info as jest.Mock).mock.calls,
    };
  },
};

// 導出測試輔助函數
export default testHelpers;