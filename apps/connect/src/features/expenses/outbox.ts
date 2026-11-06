import type { CreateExpenseArgs, ExpenseCategory, ExpenseCurrency } from '@citius/backend';

/**
 * Queued expense submissions. Each item walks create → upload → attach → submit, and is saved
 * after every step so a crash or a dropped connection resumes where it stopped. The receipt file
 * stays on the device until the item is done; nothing here deletes it.
 */

export type OutboxStage = 'queued' | 'created' | 'uploaded' | 'attached' | 'submitted';
export type OutboxStatus = 'pending' | 'needsAttention' | 'done';

export interface ExpenseDraft {
  amount: number;
  category: ExpenseCategory;
  currency: ExpenseCurrency;
  expenseDate: string;
  paidBy: string;
  particulars: string;
}

export interface ReceiptFile {
  fileName: string;
  mimeType: string;
  size: number;
  uri: string;
}

export interface OutboxItem {
  attempts: number;
  /**
   * Sent with the create as `clientRef` (the item's id). The server returns the first expense for
   * the same author and ref, so a create sent again after a timeout or an app kill files once.
   * Items queued by earlier versions have none until their create is sent.
   */
  clientRef?: string;
  createdAt: number;
  /**
   * Earlier versions set (and saved) this just before sending a create without `clientRef`. On
   * such an item the server may hold the expense under its notes ref only, so it is looked up first.
   */
  createStartedAt?: number;
  draft: ExpenseDraft;
  expenseId?: string;
  id: string;
  jobCardId: string;
  nextAttemptAt: number;
  /** Plain words for the person, set when the server refused the item. */
  problem?: string;
  receipt: ReceiptFile;
  stage: OutboxStage;
  /** The staff member who queued it; only they may send it. */
  staffId: string;
  status: OutboxStatus;
  storageId?: string;
  updatedAt: number;
}

export interface OutboxDeps {
  attachProof: (args: { expenseId: string; fileName: string; fileSize: number; mimeType: string; storageId: string }) => Promise<void>;
  createExpense: (args: CreateExpenseArgs) => Promise<string>;
  /**
   * Finds an expense an earlier version of the app created for the item (matched on the ref it
   * wrote into the notes). Only items sent before `clientRef` need it. Best effort: it searches a
   * bounded number of pages of the trip's expenses.
   */
  findExpenseByRef: (jobCardId: string, ref: string) => Promise<string | null>;
  generateUploadUrl: (expenseId: string) => Promise<string>;
  now: () => number;
  save: (item: OutboxItem) => Promise<void>;
  submitExpense: (expenseId: string) => Promise<void>;
  uploadReceipt: (url: string, receipt: ReceiptFile) => Promise<string>;
}

export const outboxKey = 'outbox:expenses';
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 30 * 60_000;

/** The notes ref earlier versions wrote on each expense, so they could find it again. */
export const refFor = (item: Pick<OutboxItem, 'id'>) => `Connect ref ${item.id}`;

export function createOutboxItem(input: {
  draft: ExpenseDraft;
  id: string;
  jobCardId: string;
  now: number;
  receipt: ReceiptFile;
  staffId: string;
}): OutboxItem {
  return {
    attempts: 0,
    clientRef: input.id,
    createdAt: input.now,
    draft: input.draft,
    id: input.id,
    jobCardId: input.jobCardId,
    nextAttemptAt: input.now,
    receipt: input.receipt,
    stage: 'queued',
    staffId: input.staffId,
    status: 'pending',
    updatedAt: input.now,
  };
}

/** Pending items whose time has come, queued by this staff member. Nobody sends another's. */
export function dueItems(items: OutboxItem[], now: number, staffId: string) {
  return items.filter((item) => item.staffId === staffId && item.status === 'pending' && item.nextAttemptAt <= now);
}

export function retryNow(item: OutboxItem, now: number): OutboxItem {
  const { problem: _problem, ...rest } = item;
  return { ...rest, attempts: 0, nextAttemptAt: now, status: 'pending', updatedAt: now };
}

/** Known server refusals, in words a tour manager can act on. Server text is never shown raw. */
const KNOWN_REFUSALS: [RegExp, string][] = [
  [/reporting manager/i, 'No reporting manager is set for you. Ask HR to add one, then try again.'],
  [/not assigned to you|job card not found/i, 'This trip is no longer assigned to you.'],
  [/file type|mime/i, 'This receipt file type is not accepted. Take a new photo.'],
  [/15 MB|between 1 byte/i, 'This receipt file is too large. Take a new photo.'],
  [/receipt file missing/i, 'The receipt photo is no longer on this phone. Delete this expense and add it again.'],
  [/forbidden/i, 'Your account is not allowed to submit this expense.'],
];

export function refusalMessage(error: unknown) {
  const text = typeof (error as { data?: unknown })?.data === 'string' ? (error as { data: string }).data : '';
  return KNOWN_REFUSALS.find(([pattern]) => pattern.test(text))?.[1] ?? 'The server did not accept this expense. Check the details and try again.';
}

/** A ConvexError carries `data`: the server decided. Anything else (network, timeouts) is retried. */
export function isServerRefusal(error: unknown) {
  return typeof error === 'object' && error !== null && 'data' in error;
}

function backoff(attempts: number) {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

async function advance(item: OutboxItem, deps: OutboxDeps): Promise<OutboxItem> {
  switch (item.stage) {
    case 'queued': {
      if (!item.clientRef && item.createStartedAt !== undefined) {
        // An earlier version sent this create without clientRef: the server may already hold it.
        const existing = await deps.findExpenseByRef(item.jobCardId, refFor(item));
        if (existing) {
          return { ...item, expenseId: existing, stage: 'created' };
        }
      }
      // Safe to resend as often as needed: the same clientRef always returns the same expense.
      const clientRef = item.clientRef ?? item.id;
      const expenseId = await deps.createExpense({
        amount: item.draft.amount,
        category: item.draft.category,
        clientRef,
        currency: item.draft.currency,
        expenseDate: item.draft.expenseDate,
        jobCardId: item.jobCardId,
        paidBy: item.draft.paidBy,
        particulars: item.draft.particulars,
      });
      return { ...item, clientRef, expenseId, stage: 'created' };
    }
    case 'created': {
      const expenseId = requireExpenseId(item);
      const url = await deps.generateUploadUrl(expenseId);
      const storageId = await deps.uploadReceipt(url, item.receipt);
      return { ...item, stage: 'uploaded', storageId };
    }
    case 'uploaded': {
      if (!item.storageId) {
        return { ...item, stage: 'created' };
      }
      await deps.attachProof({
        expenseId: requireExpenseId(item),
        fileName: item.receipt.fileName,
        fileSize: item.receipt.size,
        mimeType: item.receipt.mimeType,
        storageId: item.storageId,
      });
      return { ...item, stage: 'attached' };
    }
    case 'attached': {
      await deps.submitExpense(requireExpenseId(item));
      return { ...item, stage: 'submitted' };
    }
    case 'submitted':
      return { ...item, status: 'done' };
  }
}

function requireExpenseId(item: OutboxItem) {
  if (!item.expenseId) {
    throw new Error('Outbox item lost its expense id');
  }
  return item.expenseId;
}

export async function processItem(start: OutboxItem, deps: OutboxDeps): Promise<OutboxItem> {
  let item = start;
  while (item.status === 'pending') {
    try {
      const next = await advance(item, deps);
      item = { ...next, updatedAt: deps.now() };
      if (item.status === 'pending') {
        await deps.save(item);
      }
    } catch (error) {
      const now = deps.now();
      if (isServerRefusal(error)) {
        const stuck: OutboxItem = { ...item, problem: refusalMessage(error), status: 'needsAttention', updatedAt: now };
        if (item.stage === 'uploaded') {
          // The server deletes an uploaded file it refuses to attach, so a retry must upload again.
          const { storageId: _deleted, ...rest } = stuck;
          return { ...rest, stage: 'created' };
        }
        return stuck;
      }
      const attempts = item.attempts + 1;
      return { ...item, attempts, nextAttemptAt: now + backoff(attempts), updatedAt: now };
    }
  }
  return item;
}
