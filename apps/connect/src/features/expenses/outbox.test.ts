import { ConvexError } from 'convex/values';

import { createOutboxItem, dueItems, type OutboxDeps, type OutboxItem, processItem, retryNow } from './outbox';

const NOW = 1_000_000;

function newItem(): OutboxItem {
  return createOutboxItem({
    draft: {
      amount: 1250.5,
      category: 'Transport',
      currency: 'THB',
      expenseDate: '2026-11-06',
      paidBy: 'Test Tour Manager',
      particulars: 'Airport taxi',
    },
    id: 'ob_1',
    jobCardId: 'jc_test_1',
    now: NOW,
    receipt: { fileName: 'receipt.jpg', mimeType: 'image/jpeg', size: 2048, uri: 'file:///receipts/ob_1.jpg' },
  });
}

function fakeDeps(overrides: Partial<OutboxDeps> = {}) {
  const calls: string[] = [];
  const saved: OutboxItem[] = [];
  const deps: OutboxDeps = {
    attachProof: async (args) => {
      calls.push(`attach:${args.expenseId}:${args.storageId}:${args.fileSize}`);
    },
    createExpense: async (args) => {
      calls.push(`create:${args.amount}:${args.currency}:${args.notes}`);
      return 'exp_1';
    },
    findExpenseByRef: async () => null,
    generateUploadUrl: async (expenseId) => {
      calls.push(`url:${expenseId}`);
      return 'https://upload.example.test/1';
    },
    now: () => NOW,
    save: async (item) => {
      saved.push(item);
    },
    submitExpense: async (expenseId) => {
      calls.push(`submit:${expenseId}`);
    },
    uploadReceipt: async (url) => {
      calls.push(`upload:${url}`);
      return 'storage_1';
    },
    ...overrides,
  };
  return { calls, deps, saved };
}

describe('expense outbox', () => {
  it('creates, uploads, attaches and submits, saving after every step', async () => {
    const { calls, deps, saved } = fakeDeps();
    const done = await processItem(newItem(), deps);
    expect(calls).toEqual([
      'create:1250.5:THB:Connect ref ob_1',
      'url:exp_1',
      'upload:https://upload.example.test/1',
      'attach:exp_1:storage_1:2048',
      'submit:exp_1',
    ]);
    expect(done.status).toBe('done');
    expect(saved.map((item) => item.stage)).toEqual(['created', 'uploaded', 'attached', 'submitted']);
  });

  it('keeps the item and its receipt on a network failure, and resumes where it stopped', async () => {
    let failUpload = true;
    const { calls, deps } = fakeDeps({
      uploadReceipt: async () => {
        if (failUpload) throw new TypeError('Network request failed');
        return 'storage_2';
      },
    });
    const failed = await processItem(newItem(), deps);
    expect(failed).toMatchObject({ attempts: 1, expenseId: 'exp_1', stage: 'created', status: 'pending' });
    expect(failed.receipt.uri).toBe('file:///receipts/ob_1.jpg');
    expect(failed.nextAttemptAt).toBeGreaterThan(NOW);

    failUpload = false;
    calls.length = 0;
    const done = await processItem(failed, deps);
    expect(calls[0]).toBe('url:exp_1');
    expect(calls).not.toContain('create:1250.5:THB:Connect ref ob_1');
    expect(done.status).toBe('done');
  });

  it('does not create a second expense when an earlier create may have reached the server', async () => {
    const { calls, deps } = fakeDeps({ findExpenseByRef: async () => 'exp_existing' });
    const item = { ...newItem(), attempts: 1 };
    const done = await processItem(item, deps);
    expect(calls.some((call) => call.startsWith('create:'))).toBe(false);
    expect(done.expenseId).toBe('exp_existing');
  });

  it('stops retrying a server rejection and keeps the receipt for the user to fix', async () => {
    const { deps } = fakeDeps({
      submitExpense: async () => {
        throw new ConvexError('Reporting manager is not configured');
      },
    });
    const stuck = await processItem(newItem(), deps);
    expect(stuck).toMatchObject({ stage: 'attached', status: 'needsAttention' });
    expect(stuck.problem).toBe('No reporting manager is set for you. Ask HR to add one, then try again.');
    expect(stuck.receipt.uri).toBe('file:///receipts/ob_1.jpg');
    expect(dueItems([stuck], NOW + 10 ** 9)).toEqual([]);
    expect(retryNow(stuck, NOW).status).toBe('pending');
  });

  it('backs off between attempts and picks only due, pending items', async () => {
    const { deps } = fakeDeps({
      createExpense: async () => {
        throw new TypeError('Network request failed');
      },
    });
    const first = await processItem(newItem(), deps);
    const second = await processItem(first, { ...deps, now: () => first.nextAttemptAt });
    expect(second.nextAttemptAt - first.nextAttemptAt).toBeGreaterThan(first.nextAttemptAt - NOW);
    expect(dueItems([first], NOW)).toEqual([]);
    expect(dueItems([first], first.nextAttemptAt)).toEqual([first]);
  });
});
