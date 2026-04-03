import { QuotationItem, QuotationItemProps } from './quotation-item.entity';
import { ValidationError, BusinessError, NotFoundError } from '../../shared/errors/error-handler';
import { ERROR_CODES } from '../../shared/constants';

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface QuotationProps {
  id?: number;
  quotationNumber: string;
  customerId?: number;
  salesperson: string;
  issuedDate: Date;
  validUntil: Date;
  shippingDate?: Date;
  paymentMethod?: string;
  shippingMethod?: string;
  subtotal: number; // cents
  taxRate: number;  // basis points (500 = 5.00%)
  taxAmount: number; // cents
  otherFees: number; // cents
  totalAmount: number; // cents
  status: QuotationStatus;
  notes?: string;
  createdAt?: Date;
}

export class Quotation {
  private props: QuotationProps;
  private _items: QuotationItem[] = [];

  constructor(props: QuotationProps, items: QuotationItem[] = []) {
    this.validate(props);
    this.props = props;
    this._items = items;
    this.calculateTotals();
  }

  private validate(props: QuotationProps): void {
    if (!props.quotationNumber || props.quotationNumber.trim().length === 0) {
      throw new ValidationError('Quotation number is required', { field: 'quotationNumber' });
    }
    if (!props.salesperson || props.salesperson.trim().length === 0) {
      throw new ValidationError('Salesperson is required', { field: 'salesperson' });
    }
    if (props.validUntil < props.issuedDate) {
      throw new ValidationError('Valid until date must be after issued date', { field: 'validUntil' });
    }
    if (props.subtotal < 0 || props.taxAmount < 0 || props.totalAmount < 0) {
      throw new ValidationError('Financial amounts cannot be negative', { field: 'financialAmounts' });
    }
    if (props.taxRate < 0 || props.taxRate > 2000) {
      throw new ValidationError('Tax rate must be between 0% and 20%', { field: 'taxRate' });
    }
  }

  calculateTotals(): void {
    const subtotal = this._items.reduce((sum, item) => sum + item.calculateLineTotal(), 0);
    const taxableItems = this._items.filter(item => item.isTaxable);
    const taxableAmount = taxableItems.reduce((sum, item) => sum + item.calculateLineTotal(), 0);

    this.props.subtotal = subtotal;
    this.props.taxAmount = Math.round(taxableAmount * (this.props.taxRate / 10000)); // Convert basis points to percentage
    this.props.totalAmount = this.props.subtotal + this.props.taxAmount + (this.props.otherFees || 0);
  }

  markAsSent(): void {
    if (this.props.status === 'draft') {
      this.props.status = 'sent';
    } else {
      throw new BusinessError(
        `Cannot mark as sent from status: ${this.props.status}`,
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        { currentStatus: this.props.status, targetStatus: 'sent' }
      );
    }
  }

  markAsAccepted(): void {
    if (this.props.status === 'sent') {
      this.props.status = 'accepted';
    } else {
      throw new BusinessError(
        `Cannot mark as accepted from status: ${this.props.status}`,
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        { currentStatus: this.props.status, targetStatus: 'accepted' }
      );
    }
  }

  markAsRejected(): void {
    if (this.props.status === 'sent') {
      this.props.status = 'rejected';
    } else {
      throw new BusinessError(
        `Cannot mark as rejected from status: ${this.props.status}`,
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        { currentStatus: this.props.status, targetStatus: 'rejected' }
      );
    }
  }

  addItem(itemProps: QuotationItemProps): QuotationItem {
    const item = new QuotationItem(itemProps);
    this._items.push(item);
    this.calculateTotals();
    return item;
  }

  removeItem(itemId: number): void {
    this._items = this._items.filter(item => item.id !== itemId);
    this.calculateTotals();
  }

  updateItem(itemId: number, updates: Partial<QuotationItemProps>): QuotationItem {
    const itemIndex = this._items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new NotFoundError('Quotation item', itemId);
    }

    const currentItem = this._items[itemIndex];
    const updatedProps = {
      ...currentItem,
      ...updates,
    } as QuotationItemProps;

    const updatedItem = new QuotationItem(updatedProps);
    this._items[itemIndex] = updatedItem;
    this.calculateTotals();

    return updatedItem;
  }

  updateDetails(updates: Partial<QuotationProps>): void {
    if (updates.validUntil && updates.validUntil < this.props.issuedDate) {
      throw new ValidationError('Valid until date must be after issued date', { field: 'validUntil' });
    }
    if (updates.taxRate !== undefined && (updates.taxRate < 0 || updates.taxRate > 2000)) {
      throw new ValidationError('Tax rate must be between 0% and 20%', { field: 'taxRate' });
    }

    this.props = { ...this.props, ...updates };
    this.calculateTotals();
  }

  // Getters
  get id(): number | undefined { return this.props.id; }
  get quotationNumber(): string { return this.props.quotationNumber; }
  get customerId(): number | undefined { return this.props.customerId; }
  get salesperson(): string { return this.props.salesperson; }
  get issuedDate(): Date { return this.props.issuedDate; }
  get validUntil(): Date { return this.props.validUntil; }
  get shippingDate(): Date | undefined { return this.props.shippingDate; }
  get paymentMethod(): string | undefined { return this.props.paymentMethod; }
  get shippingMethod(): string | undefined { return this.props.shippingMethod; }
  get subtotal(): number { return this.props.subtotal; }
  get taxRate(): number { return this.props.taxRate; }
  get taxAmount(): number { return this.props.taxAmount; }
  get otherFees(): number { return this.props.otherFees; }
  get totalAmount(): number { return this.props.totalAmount; }
  get status(): QuotationStatus { return this.props.status; }
  get notes(): string | undefined { return this.props.notes; }
  get createdAt(): Date | undefined { return this.props.createdAt; }
  get items(): QuotationItem[] { return [...this._items]; }

  // Static factory method for creating from database row
  static fromDatabaseRow(row: any, items: any[] = []): Quotation {
    const quotationItems = items.map(item => QuotationItem.fromDatabaseRow(item));

    return new Quotation({
      id: row.id,
      quotationNumber: row.quotation_number,
      customerId: row.customer_id,
      salesperson: row.salesperson,
      issuedDate: row.issued_date,
      validUntil: row.valid_until,
      shippingDate: row.shipping_date,
      paymentMethod: row.payment_method,
      shippingMethod: row.shipping_method,
      subtotal: row.subtotal,
      taxRate: row.tax_rate,
      taxAmount: row.tax_amount,
      otherFees: row.other_fees,
      totalAmount: row.total_amount,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
    }, quotationItems);
  }

  // Convert to database row format
  toDatabaseRow(): any {
    return {
      id: this.props.id,
      quotation_number: this.props.quotationNumber,
      customer_id: this.props.customerId,
      salesperson: this.props.salesperson,
      issued_date: this.props.issuedDate,
      valid_until: this.props.validUntil,
      shipping_date: this.props.shippingDate,
      payment_method: this.props.paymentMethod,
      shipping_method: this.props.shippingMethod,
      subtotal: this.props.subtotal,
      tax_rate: this.props.taxRate,
      tax_amount: this.props.taxAmount,
      other_fees: this.props.otherFees,
      total_amount: this.props.totalAmount,
      status: this.props.status,
      notes: this.props.notes,
      created_at: this.props.createdAt,
    };
  }

  // Helper method to get items for database insertion
  getItemsForDatabase(): any[] {
    return this._items.map(item => item.toDatabaseRow());
  }
}