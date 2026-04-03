import { ValidationError } from '../../shared/errors/error-handler';
import { ERROR_CODES } from '../../shared/constants';

export interface CustomerProps {
  id?: number;
  companyName: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  vatNumber?: string;
  email?: string;
  createdAt?: Date;
}

export class Customer {
  private props: CustomerProps;

  constructor(props: CustomerProps) {
    this.validate(props);
    this.props = props;
  }

  private validate(props: CustomerProps): void {
    if (!props.companyName || props.companyName.trim().length === 0) {
      throw new ValidationError('Company name is required', { field: 'companyName' });
    }
    if (props.email && !this.isValidEmail(props.email)) {
      throw new ValidationError(`Invalid email format: ${props.email}`, {
        field: 'email',
        code: ERROR_CODES.INVALID_EMAIL
      });
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Getters
  get id(): number | undefined { return this.props.id; }
  get companyName(): string { return this.props.companyName; }
  get contactPerson(): string | undefined { return this.props.contactPerson; }
  get phone(): string | undefined { return this.props.phone; }
  get address(): string | undefined { return this.props.address; }
  get vatNumber(): string | undefined { return this.props.vatNumber; }
  get email(): string | undefined { return this.props.email; }
  get createdAt(): Date | undefined { return this.props.createdAt; }

  // Business methods
  updateContactInfo(contactPerson?: string, phone?: string, email?: string): void {
    if (email && !this.isValidEmail(email)) {
      throw new ValidationError(`Invalid email format: ${email}`, {
        field: 'email',
        code: ERROR_CODES.INVALID_EMAIL
      });
    }
    this.props.contactPerson = contactPerson;
    this.props.phone = phone;
    this.props.email = email;
  }

  updateCompanyInfo(companyName: string, vatNumber?: string, address?: string): void {
    if (!companyName || companyName.trim().length === 0) {
      throw new ValidationError('Company name is required', { field: 'companyName' });
    }
    this.props.companyName = companyName;
    this.props.vatNumber = vatNumber;
    this.props.address = address;
  }

  // Static factory method for creating from database row
  static fromDatabaseRow(row: any): Customer {
    return new Customer({
      id: row.id,
      companyName: row.company_name,
      contactPerson: row.contact_person,
      phone: row.phone,
      address: row.address,
      vatNumber: row.vat_number,
      email: row.email,
      createdAt: row.created_at,
    });
  }

  // Convert to database row format
  toDatabaseRow(): any {
    return {
      id: this.props.id,
      company_name: this.props.companyName,
      contact_person: this.props.contactPerson,
      phone: this.props.phone,
      address: this.props.address,
      vat_number: this.props.vatNumber,
      email: this.props.email,
      created_at: this.props.createdAt,
    };
  }
}