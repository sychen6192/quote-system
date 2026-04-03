import { Quotation } from '../../../src/core/entities/quotation.entity';
import { QuotationItem } from '../../../src/core/entities/quotation-item.entity';
import { ValidationError, BusinessError } from '../../../src/shared/errors/error-handler';
import { ERROR_CODES } from '../../../src/shared/constants';

describe('Quotation Entity', () => {
  describe('Creation', () => {
    it('should create a quotation with valid data', () => {
      const quotation = new Quotation({
        quotationNumber: 'QT-20240101-001',
        salesperson: 'John Doe',
        issuedDate: new Date('2024-01-01'),
        validUntil: new Date('2024-01-31'),
        subtotal: 0,
        taxRate: 500,
        taxAmount: 0,
        otherFees: 0,
        totalAmount: 0,
        status: 'draft',
      });

      expect(quotation.quotationNumber).toBe('QT-20240101-001');
      expect(quotation.salesperson).toBe('John Doe');
      expect(quotation.status).toBe('draft');
      expect(quotation.totalAmount).toBe(0);
    });

    it('should throw validation error for empty quotation number', () => {
      expect(() => {
        new Quotation({
          quotationNumber: '',
          salesperson: 'John Doe',
          issuedDate: new Date('2024-01-01'),
          validUntil: new Date('2024-01-31'),
          subtotal: 10000,
          taxRate: 500,
          taxAmount: 500,
          otherFees: 0,
          totalAmount: 10500,
          status: 'draft',
        });
      }).toThrow(ValidationError);
    });

    it('should throw validation error for empty salesperson', () => {
      expect(() => {
        new Quotation({
          quotationNumber: 'QT-20240101-001',
          salesperson: '',
          issuedDate: new Date('2024-01-01'),
          validUntil: new Date('2024-01-31'),
          subtotal: 10000,
          taxRate: 500,
          taxAmount: 500,
          otherFees: 0,
          totalAmount: 10500,
          status: 'draft',
        });
      }).toThrow(ValidationError);
    });

    it('should throw validation error for invalid date range', () => {
      expect(() => {
        new Quotation({
          quotationNumber: 'QT-20240101-001',
          salesperson: 'John Doe',
          issuedDate: new Date('2024-01-31'),
          validUntil: new Date('2024-01-01'),
          subtotal: 10000,
          taxRate: 500,
          taxAmount: 500,
          otherFees: 0,
          totalAmount: 10500,
          status: 'draft',
        });
      }).toThrow(ValidationError);
    });

    it('should throw validation error for invalid tax rate', () => {
      expect(() => {
        new Quotation({
          quotationNumber: 'QT-20240101-001',
          salesperson: 'John Doe',
          issuedDate: new Date('2024-01-01'),
          validUntil: new Date('2024-01-31'),
          subtotal: 10000,
          taxRate: 3000, // 30% - too high
          taxAmount: 500,
          otherFees: 0,
          totalAmount: 10500,
          status: 'draft',
        });
      }).toThrow(ValidationError);
    });
  });

  describe('Business Methods', () => {
    let quotation: Quotation;

    beforeEach(() => {
      quotation = new Quotation({
        quotationNumber: 'QT-20240101-001',
        salesperson: 'John Doe',
        issuedDate: new Date('2024-01-01'),
        validUntil: new Date('2024-01-31'),
        subtotal: 10000,
        taxRate: 500,
        taxAmount: 500,
        otherFees: 0,
        totalAmount: 10500,
        status: 'draft',
      });
    });

    it('should mark as sent from draft status', () => {
      quotation.markAsSent();
      expect(quotation.status).toBe('sent');
    });

    it('should throw business error when marking as sent from non-draft status', () => {
      quotation.markAsSent(); // First mark as sent
      expect(() => {
        quotation.markAsSent(); // Try to mark as sent again
      }).toThrow(BusinessError);
    });

    it('should calculate totals correctly with items', () => {
      const quotationWithItems = new Quotation({
        quotationNumber: 'QT-20240101-002',
        salesperson: 'John Doe',
        issuedDate: new Date('2024-01-01'),
        validUntil: new Date('2024-01-31'),
        subtotal: 0,
        taxRate: 500,
        taxAmount: 0,
        otherFees: 0,
        totalAmount: 0,
        status: 'draft',
      }, [
        new QuotationItem({
          productName: 'Product 1',
          quantity: 2,
          unitPrice: 5000, // 50.00 in cents
          isTaxable: true,
        }),
        new QuotationItem({
          productName: 'Product 2',
          quantity: 1,
          unitPrice: 3000, // 30.00 in cents
          isTaxable: false,
        }),
      ]);

      // Total calculation: (2 * 5000) + (1 * 3000) = 13000
      // Tax: only Product 1 is taxable = 10000 * 5% = 500
      // Total: 13000 + 500 = 13500
      expect(quotationWithItems.subtotal).toBe(13000);
      expect(quotationWithItems.taxAmount).toBe(500);
      expect(quotationWithItems.totalAmount).toBe(13500);
    });

    it('should add item and recalculate totals', () => {
      const item = quotation.addItem({
        productName: 'New Product',
        quantity: 3,
        unitPrice: 2000, // 20.00 in cents
        isTaxable: true,
      });

      expect(item.productName).toBe('New Product');
      expect(quotation.items.length).toBe(1);
      expect(quotation.subtotal).toBe(6000); // 3 * 2000
      expect(quotation.taxAmount).toBe(300); // 6000 * 5%
      expect(quotation.totalAmount).toBe(6300);
    });

    it('should remove item and recalculate totals', () => {
      const item = quotation.addItem({
        productName: 'Product',
        quantity: 2,
        unitPrice: 5000,
        isTaxable: true,
      });

      quotation.removeItem(item.id!);

      expect(quotation.items.length).toBe(0);
      expect(quotation.subtotal).toBe(0);
      expect(quotation.taxAmount).toBe(0);
      expect(quotation.totalAmount).toBe(0);
    });

    it('should update item and recalculate totals', () => {
      const item = quotation.addItem({
        productName: 'Product',
        quantity: 2,
        unitPrice: 5000,
        isTaxable: true,
      });

      const updatedItem = quotation.updateItem(item.id!, {
        productName: 'Product',
        quantity: 5,
        unitPrice: 3000,
        isTaxable: true,
      });

      expect(updatedItem.quantity).toBe(5);
      expect(updatedItem.unitPrice).toBe(3000);
      expect(quotation.subtotal).toBe(15000); // 5 * 3000
      expect(quotation.taxAmount).toBe(750); // 15000 * 5%
      expect(quotation.totalAmount).toBe(15750);
    });

    it('should update details', () => {
      quotation.updateDetails({
        salesperson: 'Jane Doe',
        taxRate: 1000, // 10%
        notes: 'Updated notes',
      });

      expect(quotation.salesperson).toBe('Jane Doe');
      expect(quotation.taxRate).toBe(1000);
      expect(quotation.notes).toBe('Updated notes');
    });
  });

  describe('Status Transitions', () => {
    let quotation: Quotation;

    beforeEach(() => {
      quotation = new Quotation({
        quotationNumber: 'QT-20240101-001',
        salesperson: 'John Doe',
        issuedDate: new Date('2024-01-01'),
        validUntil: new Date('2024-01-31'),
        subtotal: 10000,
        taxRate: 500,
        taxAmount: 500,
        otherFees: 0,
        totalAmount: 10500,
        status: 'draft',
      });
    });

    it('should transition from draft to sent to accepted', () => {
      quotation.markAsSent();
      expect(quotation.status).toBe('sent');

      quotation.markAsAccepted();
      expect(quotation.status).toBe('accepted');
    });

    it('should transition from draft to sent to rejected', () => {
      quotation.markAsSent();
      expect(quotation.status).toBe('sent');

      quotation.markAsRejected();
      expect(quotation.status).toBe('rejected');
    });

    it('should not allow direct transition from draft to accepted', () => {
      expect(() => {
        quotation.markAsAccepted();
      }).toThrow(BusinessError);
    });

    it('should not allow direct transition from draft to rejected', () => {
      expect(() => {
        quotation.markAsRejected();
      }).toThrow(BusinessError);
    });
  });

  describe('Database Conversion', () => {
    it('should create from database row', () => {
      const dbRow = {
        id: 1,
        quotation_number: 'QT-20240101-001',
        customer_id: 1,
        salesperson: 'John Doe',
        issued_date: new Date('2024-01-01'),
        valid_until: new Date('2024-01-31'),
        shipping_date: new Date('2024-01-15'),
        payment_method: 'bank_transfer',
        shipping_method: 'delivery',
        subtotal: 10000,
        tax_rate: 500,
        tax_amount: 500,
        other_fees: 1000,
        total_amount: 11500,
        status: 'draft',
        notes: 'Test notes',
        created_at: new Date('2024-01-01'),
      };

      const items = [
        {
          id: 1,
          quotation_id: 1,
          product_name: 'Product 1',
          quantity: 2,
          unit_price: 5000,
          is_taxable: true,
        },
      ];

      const quotation = Quotation.fromDatabaseRow(dbRow, items);

      expect(quotation.id).toBe(1);
      expect(quotation.quotationNumber).toBe('QT-20240101-001');
      expect(quotation.customerId).toBe(1);
      expect(quotation.salesperson).toBe('John Doe');
      expect(quotation.status).toBe('draft');
      expect(quotation.totalAmount).toBe(11500);
      expect(quotation.items.length).toBe(1);
    });

    it('should convert to database row', () => {
      const quotation = new Quotation({
        id: 1,
        quotationNumber: 'QT-20240101-001',
        customerId: 1,
        salesperson: 'John Doe',
        issuedDate: new Date('2024-01-01'),
        validUntil: new Date('2024-01-31'),
        shippingDate: new Date('2024-01-15'),
        paymentMethod: 'bank_transfer',
        shippingMethod: 'delivery',
        subtotal: 10000,
        taxRate: 500,
        taxAmount: 500,
        otherFees: 1000,
        totalAmount: 11500,
        status: 'draft',
        notes: 'Test notes',
        createdAt: new Date('2024-01-01'),
      });

      const dbRow = quotation.toDatabaseRow();

      expect(dbRow.id).toBe(1);
      expect(dbRow.quotation_number).toBe('QT-20240101-001');
      expect(dbRow.customer_id).toBe(1);
      expect(dbRow.salesperson).toBe('John Doe');
      expect(dbRow.status).toBe('draft');
      expect(dbRow.total_amount).toBe(1000); // Recalculated: subtotal(0) + taxAmount(0) + otherFees(1000)
    });
  });
});