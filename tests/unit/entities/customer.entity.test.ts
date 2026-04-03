import { Customer } from '../../../src/core/entities/customer.entity';
import { ValidationError } from '../../../src/shared/errors/error-handler';

describe('Customer Entity', () => {
  describe('Creation', () => {
    it('should create a customer with valid data', () => {
      const customer = new Customer({
        companyName: 'Test Company',
        contactPerson: 'John Doe',
        email: 'john@test.com',
      });

      expect(customer.companyName).toBe('Test Company');
      expect(customer.contactPerson).toBe('John Doe');
      expect(customer.email).toBe('john@test.com');
    });

    it('should throw validation error for empty company name', () => {
      expect(() => {
        new Customer({
          companyName: '',
        });
      }).toThrow(ValidationError);
    });

    it('should throw validation error for invalid email', () => {
      expect(() => {
        new Customer({
          companyName: 'Test Company',
          email: 'invalid-email',
        });
      }).toThrow(ValidationError);
    });

    it('should accept customer without email', () => {
      const customer = new Customer({
        companyName: 'Test Company',
      });

      expect(customer.companyName).toBe('Test Company');
      expect(customer.email).toBeUndefined();
    });
  });

  describe('Business Methods', () => {
    let customer: Customer;

    beforeEach(() => {
      customer = new Customer({
        companyName: 'Test Company',
        contactPerson: 'John Doe',
        email: 'john@test.com',
        phone: '1234567890',
        address: 'Test Address',
        vatNumber: '12345678',
      });
    });

    it('should update contact info with valid email', () => {
      customer.updateContactInfo('Jane Doe', '0987654321', 'jane@test.com');

      expect(customer.contactPerson).toBe('Jane Doe');
      expect(customer.phone).toBe('0987654321');
      expect(customer.email).toBe('jane@test.com');
    });

    it('should throw validation error when updating with invalid email', () => {
      expect(() => {
        customer.updateContactInfo('Jane Doe', '0987654321', 'invalid-email');
      }).toThrow(ValidationError);
    });

    it('should update company info', () => {
      customer.updateCompanyInfo('New Company Name', '87654321', 'New Address');

      expect(customer.companyName).toBe('New Company Name');
      expect(customer.vatNumber).toBe('87654321');
      expect(customer.address).toBe('New Address');
    });

    it('should throw validation error when updating with empty company name', () => {
      expect(() => {
        customer.updateCompanyInfo('');
      }).toThrow(ValidationError);
    });
  });

  describe('Database Conversion', () => {
    it('should create from database row', () => {
      const dbRow = {
        id: 1,
        company_name: 'Test Company',
        contact_person: 'John Doe',
        phone: '1234567890',
        address: 'Test Address',
        vat_number: '12345678',
        email: 'john@test.com',
        created_at: new Date('2024-01-01'),
      };

      const customer = Customer.fromDatabaseRow(dbRow);

      expect(customer.id).toBe(1);
      expect(customer.companyName).toBe('Test Company');
      expect(customer.contactPerson).toBe('John Doe');
      expect(customer.phone).toBe('1234567890');
      expect(customer.address).toBe('Test Address');
      expect(customer.vatNumber).toBe('12345678');
      expect(customer.email).toBe('john@test.com');
      expect(customer.createdAt).toEqual(new Date('2024-01-01'));
    });

    it('should convert to database row', () => {
      const customer = new Customer({
        id: 1,
        companyName: 'Test Company',
        contactPerson: 'John Doe',
        email: 'john@test.com',
        createdAt: new Date('2024-01-01'),
      });

      const dbRow = customer.toDatabaseRow();

      expect(dbRow.id).toBe(1);
      expect(dbRow.company_name).toBe('Test Company');
      expect(dbRow.contact_person).toBe('John Doe');
      expect(dbRow.email).toBe('john@test.com');
      expect(dbRow.created_at).toEqual(new Date('2024-01-01'));
    });
  });
});