import type { ExpenseRow } from '@citius/backend';

import type { OutboxItem } from './outbox';
import { categorySplit, formatAmount, spendEntries, totalsByCurrency } from './totals';

function serverRow(overrides: Partial<ExpenseRow> & Pick<ExpenseRow, 'id' | 'amount'>): ExpenseRow {
  return {
    approvalStatus: 'Pending',
    category: 'Transport',
    createdAt: '2026-11-05T08:00:00.000Z',
    currency: 'INR',
    expenseDate: '2026-11-05',
    jobCardId: 'jc_1',
    jobCode: 'JC-1',
    managerReviewStatus: 'Pending',
    notes: '',
    particulars: '',
    proofAttachment: null,
    submittedForApprovalAt: '2026-11-05T08:00:00.000Z',
    ...overrides,
  };
}

function queued(overrides: Partial<OutboxItem> & Pick<OutboxItem, 'id'> & { amount: number; currency?: 'INR' | 'USD'; category?: 'Hotel' | 'F&B' }): OutboxItem {
  const { amount, category = 'Hotel', currency = 'INR', ...rest } = overrides;
  return {
    attempts: 0,
    createdAt: 0,
    draft: { amount, category, currency, expenseDate: '2026-11-05', paidBy: 'TM', particulars: '' },
    jobCardId: 'jc_1',
    nextAttemptAt: 0,
    receipt: { fileName: 'r.jpg', mimeType: 'image/jpeg', size: 1, uri: 'file:///r.jpg' },
    stage: 'queued',
    staffId: 'staff_1',
    status: 'pending',
    updatedAt: 0,
    ...rest,
  };
}

describe('trip spend', () => {
  it('counts each expense once: server rows, plus what is only on this phone', () => {
    const server = [serverRow({ amount: 100, id: 'exp_1' }), serverRow({ amount: 50, id: 'exp_2' })];
    const outbox = [
      queued({ amount: 100, expenseId: 'exp_1', id: 'q_1', stage: 'created' }),
      queued({ amount: 30, id: 'q_2', status: 'done' }),
      queued({ amount: 20, id: 'q_3' }),
    ];
    expect(spendEntries(outbox, server).map((entry) => entry.amount)).toEqual([100, 50, 20]);
  });

  it('counts everything on this phone when the server list is not available', () => {
    const outbox = [queued({ amount: 30, id: 'q_1', status: 'done' }), queued({ amount: 20, id: 'q_2' })];
    expect(spendEntries(outbox, null).map((entry) => entry.amount)).toEqual([30, 20]);
  });

  it('totals per currency without adding currencies together, most-used first', () => {
    const totals = totalsByCurrency([
      { amount: 0.1, category: 'F&B', currency: 'USD' },
      { amount: 0.2, category: 'F&B', currency: 'USD' },
      { amount: 5000, category: 'Hotel', currency: 'INR' },
    ]);
    expect(totals).toEqual([
      { count: 2, currency: 'USD', total: 0.3 },
      { count: 1, currency: 'INR', total: 5000 },
    ]);
  });

  it('splits one currency by category, largest first, with shares that add up to one', () => {
    const split = categorySplit(
      [
        { amount: 300, category: 'Transport', currency: 'INR' },
        { amount: 100, category: 'F&B', currency: 'INR' },
        { amount: 600, category: 'Transport', currency: 'INR' },
        { amount: 999, category: 'Hotel', currency: 'USD' },
      ],
      'INR'
    );
    expect(split).toEqual([
      { category: 'Transport', share: 0.9, total: 900 },
      { category: 'F&B', share: 0.1, total: 100 },
    ]);
    expect(categorySplit([], 'INR')).toEqual([]);
  });

  it('formats the figure with the currency’s own decimals and no sign', () => {
    expect(formatAmount(1250.5, 'INR', 'en-GB')).toBe('1,250.50');
    expect(formatAmount(1250, 'JPY', 'en-GB')).toBe('1,250');
  });
});
