import { ValidationError } from '../../shared/errors/error-handler';

export interface QuotationItemProps {
  id?: number;
  quotationId?: number;
  productName: string;
  quantity: number;
  unitPrice: number; // Stored in cents
  isTaxable: boolean;
}

export class QuotationItem {
  private props: QuotationItemProps;

  constructor(props: QuotationItemProps) {
    this.validate(props);
    this.props = props;
  }

  private validate(props: QuotationItemProps): void {
    if (!props.productName || props.productName.trim().length === 0) {
      throw new ValidationError('Product name is required', { field: 'productName' });
    }
    if (props.quantity <= 0) {
      throw new ValidationError('Quantity must be greater than 0', { field: 'quantity' });
    }
    if (props.unitPrice < 0) {
      throw new ValidationError('Unit price cannot be negative', { field: 'unitPrice' });
    }
  }

  calculateLineTotal(): number {
    return this.props.quantity * this.props.unitPrice;
  }

  // Getters
  get id(): number | undefined { return this.props.id; }
  get quotationId(): number | undefined { return this.props.quotationId; }
  get productName(): string { return this.props.productName; }
  get quantity(): number { return this.props.quantity; }
  get unitPrice(): number { return this.props.unitPrice; }
  get isTaxable(): boolean { return this.props.isTaxable; }

  // Business methods
  updateQuantity(quantity: number): void {
    if (quantity <= 0) {
      throw new ValidationError('Quantity must be greater than 0', { field: 'quantity' });
    }
    this.props.quantity = quantity;
  }

  updatePrice(unitPrice: number): void {
    if (unitPrice < 0) {
      throw new ValidationError('Unit price cannot be negative', { field: 'unitPrice' });
    }
    this.props.unitPrice = unitPrice;
  }

  updateProductInfo(productName: string, isTaxable: boolean): void {
    if (!productName || productName.trim().length === 0) {
      throw new ValidationError('Product name is required', { field: 'productName' });
    }
    this.props.productName = productName;
    this.props.isTaxable = isTaxable;
  }

  // Static factory method for creating from database row
  static fromDatabaseRow(row: any): QuotationItem {
    return new QuotationItem({
      id: row.id,
      quotationId: row.quotation_id,
      productName: row.product_name,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      isTaxable: row.is_taxable,
    });
  }

  // Convert to database row format
  toDatabaseRow(): any {
    return {
      id: this.props.id,
      quotation_id: this.props.quotationId,
      product_name: this.props.productName,
      quantity: this.props.quantity,
      unit_price: this.props.unitPrice,
      is_taxable: this.props.isTaxable,
    };
  }
}