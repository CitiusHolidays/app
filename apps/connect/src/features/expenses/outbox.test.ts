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
    staffId: 'staff_1',
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
    expect(saved.map((item) => item.stage)).toEqual(['queued', 'created', 'uploaded', 'attached', 'submitted']);
    expect(saved[0]?.createStartedAt).toBe(NOW);
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

  it('does not file twice when the app dies after create reached the server', async () => {
    const server: { id: string; notes: string }[] = [];
    const first = fakeDeps({
      // The server stores the expense, then the app is killed before the answer arrives.
      createExpense: (args) => {
        server.push({ id: 'exp_server', notes: String(args.notes) });
        return new Promise(() => undefined);
      },
      findExpenseByRef: async (_jobCardId, ref) => server.find((row) => row.notes === ref)?.id ?? null,
    });
    void processItem(newItem(), first.deps);
    await new Promise((resolve) => setTimeout(resolve, 0));
    // After a restart the outbox resumes from the last saved copy of the item.
    const afterRestart = first.saved.at(-1) ?? newItem();

    const second = fakeDeps({ findExpenseByRef: async (_jobCardId, ref) => server.find((row) => row.notes === ref)?.id ?? null });
    const done = await processItem(afterRestart, second.deps);
    expect(server).toHaveLength(1);
    expect(second.calls.some((call) => call.startsWith('create:'))).toBe(false);
    expect(done).toMatchObject({ expenseId: 'exp_server', status: 'done' });
  });

  it('looks the ref up before creating again after a create that failed on the network', async () => {
    let lookups = 0;
    let failCreate = true;
    const { deps } = fakeDeps({
      createExpense: async () => {
        if (failCreate) throw new TypeError('Network request failed');
        return 'exp_2';
      },
      findExpenseByRef: async () => {
        lookups += 1;
        return null;
      },
    });
    const failed = await processItem(newItem(), deps);
    expect(lookups).toBe(0);
    failCreate = false;
    const done = await processItem(failed, deps);
    expect(lookups).toBe(1);
    expect(done.expenseId).toBe('exp_2');
  });

  it('re-uploads on retry when the server refused the proof and deleted the uploaded file', async () => {
    let refuse = true;
    const { calls, deps } = fakeDeps({
      attachProof: async (args) => {
        calls.push(`attach:${args.storageId}`);
        if (refuse) throw new ConvexError('Unsupported file type');
      },
    });
    const stuck = await processItem(newItem(), deps);
    expect(stuck).toMatchObject({ stage: 'created', status: 'needsAttention' });
    expect(stuck.storageId).toBeUndefined();

    refuse = false;
    calls.length = 0;
    const done = await processItem(retryNow(stuck, NOW), deps);
    expect(calls).toEqual(['url:exp_1', 'upload:https://upload.example.test/1', 'attach:storage_1', 'submit:exp_1']);
    expect(done.status).toBe('done');
  });

  it("never sends another staff member's queued expense", () => {
    const mine = newItem();
    const theirs = { ...newItem(), id: 'ob_2', staffId: 'staff_2' };
    expect(dueItems([mine, theirs], NOW, 'staff_1')).toEqual([mine]);
    expect(dueItems([mine, theirs], NOW, 'staff_2')).toEqual([theirs]);
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
    expect(dueItems([stuck], NOW + 10 ** 9, 'staff_1')).toEqual([]);
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
    expect(dueItems([first], NOW, 'staff_1')).toEqual([]);
    expect(dueItems([first], first.nextAttemptAt, 'staff_1')).toEqual([first]);
  });
});
