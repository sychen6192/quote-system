jest.mock('@/db', () => ({
  db: {
    transaction: jest.fn(),
    query: {
      quotations: {
        findFirst: jest.fn(),
      },
    },
  },
}));
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { updateQuote } from '@/actions/update-quote';
import { db } from '@/db';
import type { QuoteFormData } from '@/lib/schemas/quote';

const mockTransaction = db.transaction as jest.Mock;
const mockFindFirst = db.query.quotations.findFirst as jest.Mock;

function validInput(overrides: Record<string, unknown> = {}): QuoteFormData {
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
  } as QuoteFormData;
}

describe('updateQuote', () => {
  describe('VALIDATION', () => {
    it('rejects missing companyName without touching the DB', async () => {
      const res = await updateQuote(1, validInput({ companyName: '' }));
      expect(res).toMatchObject({ success: false, code: 'VALIDATION' });
      if (!res.success && res.code === 'VALIDATION') {
        expect(res.fieldErrors.companyName).toBeDefined();
      }
      expect(mockFindFirst).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('rejects validUntil earlier than issuedDate', async () => {
      const res = await updateQuote(
        1,
        validInput({ issuedDate: '2026-05-01', validUntil: '2026-04-01' }),
      );
      expect(res).toMatchObject({ success: false, code: 'VALIDATION' });
      if (!res.success && res.code === 'VALIDATION') {
        expect(res.fieldErrors.validUntil).toBeDefined();
      }
    });
  });

  describe('NOT_FOUND', () => {
    it('returns NOT_FOUND when quote does not exist', async () => {
      mockFindFirst.mockResolvedValueOnce(undefined);
      const res = await updateQuote(999, validInput());
      expect(res).toMatchObject({
        success: false,
        code: 'NOT_FOUND',
      });
      if (!res.success && res.code === 'NOT_FOUND') {
        expect(res.message).toContain('999');
      }
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when quote has no associated customer', async () => {
      mockFindFirst.mockResolvedValueOnce({ id: 1, customerId: null });
      const res = await updateQuote(1, validInput());
      expect(res).toMatchObject({ success: false, code: 'NOT_FOUND' });
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('INTERNAL', () => {
    it('returns INTERNAL with error message when transaction throws', async () => {
      mockFindFirst.mockResolvedValueOnce({ id: 1, customerId: 42 });
      mockTransaction.mockRejectedValueOnce(new Error('deadlock detected'));
      const res = await updateQuote(1, validInput());
      expect(res).toMatchObject({
        success: false,
        code: 'INTERNAL',
        message: 'deadlock detected',
      });
    });

    it('returns INTERNAL with fallback message when transaction throws non-Error', async () => {
      mockFindFirst.mockResolvedValueOnce({ id: 1, customerId: 42 });
      mockTransaction.mockRejectedValueOnce({ weird: true });
      const res = await updateQuote(1, validInput());
      expect(res).toMatchObject({
        success: false,
        code: 'INTERNAL',
        message: 'Failed to update quote',
      });
    });
  });
});
