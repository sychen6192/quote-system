jest.mock('@/db', () => ({
  db: {
    query: { quotations: { findFirst: jest.fn() } },
    transaction: jest.fn(),
  },
}));
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { deleteQuote } from '@/actions/delete-quote';
import { db } from '@/db';

const mockFindFirst = (
  db as unknown as {
    query: { quotations: { findFirst: jest.Mock } };
  }
).query.quotations.findFirst;
const mockTransaction = db.transaction as jest.Mock;

describe('deleteQuote', () => {
  it('returns NOT_FOUND when the quote does not exist', async () => {
    mockFindFirst.mockResolvedValueOnce(undefined);
    const res = await deleteQuote(999);
    expect(res).toMatchObject({ success: false, code: 'NOT_FOUND' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('deletes the quote and returns success', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 1 });
    mockTransaction.mockResolvedValueOnce(undefined);
    const res = await deleteQuote(1);
    expect(res).toEqual({ success: true });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('returns INTERNAL with the error message when the transaction throws', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 1 });
    mockTransaction.mockRejectedValueOnce(new Error('DB down'));
    const res = await deleteQuote(1);
    expect(res).toMatchObject({
      success: false,
      code: 'INTERNAL',
      message: 'DB down',
    });
  });
});
