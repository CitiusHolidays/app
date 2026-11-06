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
      calls.push(`create:${args.amount}:${args.currency}:${args.clientRef}`);
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
      'create:1250.5:THB:ob_1',
      'url:exp_1',
      'upload:https://upload.example.test/1',
      'attach:exp_1:storage_1:2048',
      'submit:exp_1',
    ]);
    expect(done.status).toBe('done');
    expect(saved.map((item) => item.stage)).toEqual(['created', 'uploaded', 'attached', 'submitted']);
  });

  it("passes the item's own id as clientRef, so the server files a resent create once", async () => {
    const created: Record<string, unknown>[] = [];
    const { deps } = fakeDeps({
      createExpense: async (args) => {
        created.push(args);
        return 'exp_1';
      },
    });
    await processItem(newItem(), deps);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ clientRef: 'ob_1', jobCardId: 'jc_test_1' });
    expect(created[0]).not.toHaveProperty('notes');
    expect(/^[A-Za-z0-9._:-]{1,128}$/.test(String(created[0]?.clientRef))).toBe(true);
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
    expect(calls).not.toContain('create:1250.5:THB:ob_1');
    expect(done.status).toBe('done');
  });

  it('does not file twice when the app dies after create reached the server', async () => {
    // The server keeps the first expense per author and clientRef, and returns it on a replay.
    const server: { clientRef: string; id: string }[] = [];
    const serverCreate = async (args: { clientRef?: string }) => {
      const existing = server.find((row) => row.clientRef === args.clientRef);
      if (existing) return existing.id;
      server.push({ clientRef: String(args.clientRef), id: `exp_server_${server.length + 1}` });
      return `exp_server_${server.length}`;
    };
    const lookups = jest.fn(async () => null);
    const first = fakeDeps({
      // The server stores the expense, then the app is killed before the answer arrives.
      createExpense: (args) => {
        void serverCreate(args);
        return new Promise(() => undefined);
      },
      findExpenseByRef: lookups,
    });
    void processItem(newItem(), first.deps);
    await new Promise((resolve) => setTimeout(resolve, 0));
    // After a restart the outbox resumes from the last saved copy of the item.
    const afterRestart = first.saved.at(-1) ?? newItem();

    const second = fakeDeps({ createExpense: serverCreate, findExpenseByRef: lookups });
    const done = await processItem(afterRestart, second.deps);
    expect(server).toHaveLength(1);
    expect(done).toMatchObject({ expenseId: 'exp_server_1', status: 'done' });
    expect(lookups).not.toHaveBeenCalled();
  });

  it('looks an item an earlier version already sent up by its notes ref before creating it again', async () => {
    // Queued and sent by a build without clientRef: the server may hold it under the notes ref only.
    const { clientRef: _none, ...legacy } = { ...newItem(), createStartedAt: NOW };
    const created: unknown[] = [];
    const found = fakeDeps({
      createExpense: async (args) => {
        created.push(args);
        return 'exp_new';
      },
      findExpenseByRef: async (_jobCardId, ref) => (ref === 'Connect ref ob_1' ? 'exp_old' : null),
    });
    expect(await processItem(legacy, found.deps)).toMatchObject({ expenseId: 'exp_old', status: 'done' });
    expect(created).toEqual([]);

    const missing = fakeDeps({ findExpenseByRef: async () => null });
    const done = await processItem(legacy, missing.deps);
    expect(missing.calls[0]).toBe('create:1250.5:THB:ob_1');
    expect(done).toMatchObject({ clientRef: 'ob_1', expenseId: 'exp_1' });
  });

  it('does not look anything up for an item this version queued, even after a failed create', async () => {
    let failCreate = true;
    const lookups = jest.fn(async () => null);
    const { deps } = fakeDeps({
      createExpense: async () => {
        if (failCreate) throw new TypeError('Network request failed');
        return 'exp_2';
      },
      findExpenseByRef: lookups,
    });
    const failed = await processItem(newItem(), deps);
    failCreate = false;
    const done = await processItem(failed, deps);
    expect(lookups).not.toHaveBeenCalled();
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
