import { ERROR_CODES } from '../constants';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = ERROR_CODES.UNKNOWN_ERROR,
    public readonly statusCode: number = 500,
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.VALIDATION_ERROR, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, ERROR_CODES.RECORD_NOT_FOUND, 404);
  }
}

export class BusinessError extends AppError {
  constructor(message: string, code: string = ERROR_CODES.UNKNOWN_ERROR, details?: any) {
    super(message, code, 400, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.DATABASE_ERROR, 500, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(`External service error (${service}): ${message}`, ERROR_CODES.EXTERNAL_SERVICE_ERROR, 502, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ErrorHandler {
  static handle(error: unknown): ErrorResponse {
    console.error('Error caught by ErrorHandler:', error);

    // 如果是已知的 AppError
    if (error instanceof AppError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // 如果是 Zod 驗證錯誤
    if (error && typeof error === 'object' && 'errors' in error) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Validation failed',
          details: error,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // 如果是資料庫錯誤（例如 Drizzle 錯誤）
    if (error && typeof error === 'object' && 'code' in error) {
      const dbError = error as any;
      if (dbError.code === '23505') { // 唯一約束違反
        return {
          success: false,
          error: {
            code: ERROR_CODES.DUPLICATE_ENTRY,
            message: 'Duplicate entry found',
            details: dbError,
            timestamp: new Date().toISOString(),
          },
        };
      }
      if (dbError.code === '23503') { // 外鍵約束違反
        return {
          success: false,
          error: {
            code: ERROR_CODES.FOREIGN_KEY_CONSTRAINT,
            message: 'Foreign key constraint violation',
            details: dbError,
            timestamp: new Date().toISOString(),
          },
        };
      }
    }

    // 預設錯誤處理
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;

    return {
      success: false,
      error: {
        code: ERROR_CODES.UNKNOWN_ERROR,
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? { stack: errorStack } : undefined,
        timestamp: new Date().toISOString(),
      },
    };
  }

  static toHttpResponse(error: unknown): Response {
    const errorResponse = this.handle(error);
    const statusCode = error instanceof AppError ? error.statusCode : 500;

    return new Response(JSON.stringify(errorResponse), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  static logError(error: unknown, context?: string): void {
    const timestamp = new Date().toISOString();
    const contextMsg = context ? `[${context}] ` : '';

    if (error instanceof AppError) {
      console.error(`${contextMsg}[${timestamp}] AppError:`, {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
        stack: error.stack,
      });
    } else if (error instanceof Error) {
      console.error(`${contextMsg}[${timestamp}] Error:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error(`${contextMsg}[${timestamp}] Unknown error:`, error);
    }
  }

  static isValidationError(error: unknown): boolean {
    return error instanceof ValidationError ||
           (error && typeof error === 'object' && 'code' in error && (error as any).code === ERROR_CODES.VALIDATION_ERROR);
  }

  static isNotFoundError(error: unknown): boolean {
    return error instanceof NotFoundError ||
           (error && typeof error === 'object' && 'code' in error && (error as any).code === ERROR_CODES.RECORD_NOT_FOUND);
  }

  static isBusinessError(error: unknown): boolean {
    return error instanceof BusinessError ||
           (error && typeof error === 'object' && 'code' in error && [
             ERROR_CODES.INSUFFICIENT_STOCK,
             ERROR_CODES.INVALID_STATUS_TRANSITION,
             ERROR_CODES.QUOTATION_EXPIRED,
           ].includes((error as any).code));
  }

  static isDatabaseError(error: unknown): boolean {
    return error instanceof DatabaseError ||
           (error && typeof error === 'object' && 'code' in error && (error as any).code === ERROR_CODES.DATABASE_ERROR);
  }

  static isExternalServiceError(error: unknown): boolean {
    return error instanceof ExternalServiceError ||
           (error && typeof error === 'object' && 'code' in error && (error as any).code === ERROR_CODES.EXTERNAL_SERVICE_ERROR);
  }

  static wrapAsync(fn: (...args: any[]) => Promise<any>) {
    return async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.logError(error, fn.name);
        throw error;
      }
    };
  }
}

// 全域錯誤處理中間件
export const errorMiddleware = (handler: Function) => {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      return ErrorHandler.toHttpResponse(error);
    }
  };
};

// 注意：錯誤邊界組件（React）的實現應該在 React 組件文件中
// 這裡只提供類型定義和工廠函數

// 錯誤邊界相關的功能應該在 React 組件中實現
// 這裡只提供錯誤處理工具，不包含 UI 相關的代碼