jest.mock('@/db', () => ({
  db: {
    transaction: jest.fn(),
  },
}));
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { createQuote } from '@/actions/create-quote';
import { db } from '@/db';

const mockTransaction = db.transaction as jest.Mock;

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    companyName: 'Acme Corp',
    contactPerson: 'Jane Doe',
    email: 'jane@acme.test',
    phone: '+886-2-1234-5678',
    address: 'Taipei',
    vatNumber: '12345678',
    salesperson: 'Alice',
    issuedDate: '2026-04-01',
    validUntil: '2026-05-01',
    shippingDate: '',
    paymentMethod: '',
    shippingMethod: '',
    taxRate: 5,
    notes: '',
    items: [
      { productName: 'Widget', quantity: 2, unitPrice: 100, isTaxable: true },
    ],
    ...overrides,
  };
}

describe('createQuote', () => {
  describe('VALIDATION', () => {
    it('rejects missing companyName', async () => {
      const res = await createQuote(validInput({ companyName: '' }));
      expect(res).toMatchObject({ success: false, code: 'VALIDATION' });
      if (!res.success && res.code === 'VALIDATION') {
        expect(res.fieldErrors.companyName).toBeDefined();
      }
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('rejects missing salesperson', async () => {
      const res = await createQuote(validInput({ salesperson: '' }));
      expect(res).toMatchObject({ success: false, code: 'VALIDATION' });
      if (!res.success && res.code === 'VALIDATION') {
        expect(res.fieldErrors.salesperson).toBeDefined();
      }
    });

    it('rejects malformed email', async () => {
      const res = await createQuote(validInput({ email: 'not-an-email' }));
      expect(res).toMatchObject({ success: false, code: 'VALIDATION' });
      if (!res.success && res.code === 'VALIDATION') {
        expect(res.fieldErrors.email).toBeDefined();
      }
    });

    it('accepts empty email string (optional field)', async () => {
      mockTransaction.mockResolvedValueOnce(undefined);
      const res = await createQuote(validInput({ email: '' }));
      expect(res).toEqual({ success: true });
    });

    it('rejects taxRate above 20%', async () => {
      const res = await createQuote(validInput({ taxRate: 25 }));
      expect(res).toMatchObject({ success: false, code: 'VALIDATION' });
      if (!res.success && res.code === 'VALIDATION') {
        expect(res.fieldErrors.taxRate).toBeDefined();
      }
    });

    it('rejects validUntil earlier than issuedDate', async () => {
      const res = await createQuote(
        validInput({ issuedDate: '2026-05-01', validUntil: '2026-04-01' }),
      );
      expect(res).toMatchObject({ success: false, code: 'VALIDATION' });
      if (!res.success && res.code === 'VALIDATION') {
        expect(res.fieldErrors.validUntil).toBeDefined();
      }
    });

    it('accepts validUntil equal to issuedDate', async () => {
      mockTransaction.mockResolvedValueOnce(undefined);
      const res = await createQuote(
        validInput({ issuedDate: '2026-04-01', validUntil: '2026-04-01' }),
      );
      expect(res).toEqual({ success: true });
    });
  });

  describe('INTERNAL', () => {
    it('returns INTERNAL with error message when transaction throws', async () => {
      mockTransaction.mockRejectedValueOnce(new Error('DB connection lost'));
      const res = await createQuote(validInput());
      expect(res).toMatchObject({
        success: false,
        code: 'INTERNAL',
        message: 'DB connection lost',
      });
    });

    it('returns INTERNAL with fallback message when transaction throws non-Error', async () => {
      mockTransaction.mockRejectedValueOnce('string rejection');
      const res = await createQuote(validInput());
      expect(res).toMatchObject({
        success: false,
        code: 'INTERNAL',
        message: 'Transaction failed',
      });
    });
  });
});
