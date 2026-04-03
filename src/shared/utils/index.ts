// 金額轉換工具
export class MoneyUtils {
  // 將元轉換為分
  static yuanToCents(yuan: number): number {
    return Math.round(yuan * 100);
  }

  // 將分轉換為元
  static centsToYuan(cents: number): number {
    return cents / 100;
  }

  // 格式化金額顯示（元）
  static formatYuan(yuan: number, locale: string = 'zh-TW', currency: string = 'TWD'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(yuan);
  }

  // 格式化分金額
  static formatCents(cents: number, locale: string = 'zh-TW', currency: string = 'TWD'): string {
    return this.formatYuan(this.centsToYuan(cents), locale, currency);
  }

  // 計算百分比
  static calculatePercentage(part: number, total: number): number {
    if (total === 0) return 0;
    return (part / total) * 100;
  }

  // 計算稅額（基礎點轉換）
  static calculateTaxAmount(amount: number, taxRateBasisPoints: number): number {
    return Math.round(amount * (taxRateBasisPoints / 10000));
  }

  // 計算含稅總額
  static calculateTotalWithTax(subtotal: number, taxRateBasisPoints: number): number {
    const taxAmount = this.calculateTaxAmount(subtotal, taxRateBasisPoints);
    return subtotal + taxAmount;
  }
}

// 日期工具
export class DateUtils {
  // 格式化日期
  static formatDate(date: Date, format: string = 'yyyy-MM-dd'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace('yyyy', String(year))
      .replace('MM', month)
      .replace('dd', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  // 從字串解析日期
  static parseDate(dateString: string): Date | null {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }

  // 計算日期差異（天數）
  static diffInDays(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // 增加天數
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // 檢查日期是否在範圍內
  static isDateInRange(date: Date, start: Date, end: Date): boolean {
    return date >= start && date <= end;
  }

  // 取得當月第一天
  static firstDayOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  // 取得當月最後一天
  static lastDayOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }
}

// 驗證工具
export class ValidationUtils {
  // 驗證電子郵件
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // 驗證電話號碼（簡單驗證）
  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 8;
  }

  // 驗證統一編號
  static isValidVATNumber(vat: string): boolean {
    // 簡單的台灣統一編號驗證（8位數字）
    const vatRegex = /^\d{8}$/;
    if (!vatRegex.test(vat)) return false;

    // 檢查碼驗證（台灣統一編號驗證規則）
    const weights = [1, 2, 1, 2, 1, 2, 4, 1];
    let sum = 0;

    for (let i = 0; i < 8; i++) {
      const digit = parseInt(vat.charAt(i));
      const weighted = digit * weights[i];
      sum += Math.floor(weighted / 10) + (weighted % 10);
    }

    return sum % 10 === 0 || (vat.charAt(6) === '7' && (sum + 1) % 10 === 0);
  }

  // 驗證非空字串
  static isNotEmpty(str: string): boolean {
    return str !== null && str !== undefined && str.trim().length > 0;
  }

  // 驗證數字範圍
  static isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  // 驗證正整數
  static isPositiveInteger(value: number): boolean {
    return Number.isInteger(value) && value > 0;
  }
}

// 字串工具
export class StringUtils {
  // 截斷字串
  static truncate(str: string, maxLength: number, suffix: string = '...'): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
  }

  // 轉換為標題大小寫
  static toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }

  // 移除空白字元
  static removeWhitespace(str: string): string {
    return str.replace(/\s+/g, '');
  }

  // 產生隨機字串
  static generateRandomString(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // 檢查是否為數字字串
  static isNumericString(str: string): boolean {
    return /^\d+$/.test(str);
  }
}

// 陣列工具
export class ArrayUtils {
  // 唯一值
  static unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  // 分組
  static groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  // 排序
  static sortBy<T>(array: T[], keyFn: (item: T) => any, direction: 'asc' | 'desc' = 'asc'): T[] {
    return [...array].sort((a, b) => {
      const aValue = keyFn(a);
      const bValue = keyFn(b);
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // 分頁
  static paginate<T>(array: T[], page: number, pageSize: number): T[] {
    const startIndex = (page - 1) * pageSize;
    return array.slice(startIndex, startIndex + pageSize);
  }

  // 尋找元素
  static findDeep<T>(array: T[], predicate: (item: T) => boolean, childrenKey: keyof T): T | null {
    for (const item of array) {
      if (predicate(item)) {
        return item;
      }
      const children = item[childrenKey] as any;
      if (Array.isArray(children)) {
        const found = this.findDeep(children, predicate, childrenKey);
        if (found) return found;
      }
    }
    return null;
  }
}

// 物件工具
export class ObjectUtils {
  // 深層複製
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  // 合併物件
  static merge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    return { ...target, ...source };
  }

  // 移除空值屬性
  static removeEmptyProperties<T extends Record<string, any>>(obj: T): Partial<T> {
    const result: Partial<T> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined && value !== '') {
        result[key as keyof T] = value;
      }
    }
    return result;
  }

  // 檢查是否為空物件
  static isEmpty(obj: Record<string, any>): boolean {
    return Object.keys(obj).length === 0;
  }

  // 取得巢狀屬性值
  static getNestedValue(obj: any, path: string, defaultValue: any = undefined): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[key];
    }

    return current === undefined ? defaultValue : current;
  }
}