import type { CreateExpenseArgs, ExpenseCategory, ExpenseCurrency, StaffApi } from '@citius/backend';
import type { FunctionArgs } from 'convex/server';

import { backoff, isServerRefusal, knownRefusal } from '@/lib/refusal';

/**
 * Queued expense submissions. Each item walks create → upload → attach → submit, and is saved
 * after every step so a crash or a dropped connection resumes where it stopped. The receipt file
 * stays on the device until the item is done; nothing here deletes it.
 */

type OutboxStage = 'queued' | 'created' | 'uploaded' | 'attached' | 'submitted';

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

/** What every item carries, whatever its stage. */
interface OutboxBase {
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
  id: string;
  jobCardId: string;
  nextAttemptAt: number;
  receipt: ReceiptFile;
  /** The staff member who queued it; only they may send it. */
  staffId: string;
  updatedAt: number;
}

/**
 * Where the item is in create → upload → attach → submit. Each stage carries exactly what the next
 * step needs: from `created` on there is a server expense, and only `uploaded` holds a storage id
 * (the server deletes the file once it is attached, or when it refuses it).
 */
type OutboxStep =
  | { expenseId?: undefined; stage: 'queued'; storageId?: undefined }
  | { expenseId: string; stage: 'created'; storageId?: undefined }
  | { expenseId: string; stage: 'uploaded'; storageId: string }
  | { expenseId: string; stage: 'attached'; storageId?: undefined }
  | { expenseId: string; stage: 'submitted'; storageId?: undefined };

type Pending = OutboxStep & { problem?: undefined; status: 'pending' };
/** Refused by the server, with plain words for the person. A refused upload starts again at `created`. */
type NeedsAttention = Exclude<OutboxStep, { stage: 'uploaded' }> & { problem: string; status: 'needsAttention' };
/** Only a submitted item is done. */
type Done = Extract<OutboxStep, { stage: 'submitted' }> & { problem?: undefined; status: 'done' };

export type OutboxItem = OutboxBase & (Pending | NeedsAttention | Done);
export type PendingItem = Extract<OutboxItem, { status: 'pending' }>;

export interface OutboxDeps {
  attachProof: (args: FunctionArgs<StaffApi['attachExpenseProof']['ref']>) => Promise<void>;
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
const UNKNOWN_REFUSAL = 'The server did not accept this expense. Check the details and try again.';

/** The notes ref earlier versions wrote on each expense, so they could find it again. */
const refFor = (item: Pick<OutboxItem, 'id'>) => `Connect ref ${item.id}`;

export function createOutboxItem(input: {
  draft: ExpenseDraft;
  id: string;
  jobCardId: string;
  now: number;
  receipt: ReceiptFile;
  staffId: string;
}): Extract<OutboxItem, { stage: 'queued'; status: 'pending' }> {
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
export function dueItems(items: OutboxItem[], now: number, staffId: string): PendingItem[] {
  return items.filter((item): item is PendingItem => item.staffId === staffId && item.status === 'pending' && item.nextAttemptAt <= now);
}

/** A refused item goes back in the queue, due at once. Anything else is left as it is. */
export function retryNow(item: OutboxItem, now: number): OutboxItem {
  if (item.status !== 'needsAttention') return item;
  const { problem: _problem, status: _status, ...rest } = item;
  return { ...rest, attempts: 0, nextAttemptAt: now, status: 'pending', updatedAt: now };
}

/** Known server refusals, in words a tour manager can act on. Server text is never shown raw. */
const KNOWN_REFUSALS: [RegExp, string][] = [
  [/APP_PILOT_OFF/, 'This trip is not live in the app any more, so this expense was not sent. Give the receipt to Operations.'],
  [/reporting manager/i, 'No reporting manager is set for you. Ask HR to add one, then try again.'],
  [/not assigned to you|job card not found/i, 'This trip is no longer assigned to you.'],
  [/file type|mime/i, 'This receipt file type is not accepted. Take a new photo.'],
  [/15 MB|between 1 byte/i, 'This receipt file is too large. Take a new photo.'],
  [/receipt file missing/i, 'The receipt photo is no longer on this phone. Delete this expense and add it again.'],
  [/forbidden/i, 'Your account is not allowed to submit this expense.'],
];

export function refusalMessage(error: unknown) {
  return knownRefusal(error, KNOWN_REFUSALS, UNKNOWN_REFUSAL);
}

/** One step forward. Each case returns the next stage with exactly the fields that stage carries. */
async function advance(item: PendingItem, deps: OutboxDeps): Promise<OutboxItem> {
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
      const url = await deps.generateUploadUrl(item.expenseId);
      const storageId = await deps.uploadReceipt(url, item.receipt);
      return { ...item, stage: 'uploaded', storageId };
    }
    case 'uploaded': {
      await deps.attachProof({
        expenseId: item.expenseId,
        fileName: item.receipt.fileName,
        fileSize: item.receipt.size,
        mimeType: item.receipt.mimeType,
        storageId: item.storageId,
      });
      const { storageId: _attached, ...rest } = item;
      return { ...rest, stage: 'attached' };
    }
    case 'attached': {
      await deps.submitExpense(item.expenseId);
      return { ...item, stage: 'submitted' };
    }
    case 'submitted':
      return { ...item, status: 'done' };
  }
}

/** The server said no: the item stops until the person retries or deletes it. */
function refused(item: PendingItem, error: unknown, now: number): OutboxItem {
  const problem = refusalMessage(error);
  if (item.stage === 'uploaded') {
    // The server deletes an uploaded file it refuses to attach, so a retry must upload again.
    const { storageId: _deleted, ...rest } = item;
    return { ...rest, problem, stage: 'created', status: 'needsAttention', updatedAt: now };
  }
  return { ...item, problem, status: 'needsAttention', updatedAt: now };
}

/**
 * One run over the queue: sends this staff member's due items one at a time, in queue order, and
 * saves each outcome. Sequential on purpose: each item's saved stage is what a crash resumes from,
 * and a sign-out (`isCurrent` turning false) must stop the run before its next request.
 */
export async function drainOutbox(run: {
  deps: OutboxDeps;
  isCurrent: () => boolean;
  items: OutboxItem[];
  onSettled: (item: OutboxItem) => void;
  staffId: string;
}) {
  for (const item of dueItems(run.items, run.deps.now(), run.staffId)) {
    if (!run.isCurrent()) return;
    const result = await processItem(item, run.deps);
    if (!run.isCurrent()) return;
    await run.deps.save(result);
    run.onSettled(result);
  }
}

export async function processItem(start: OutboxItem, deps: OutboxDeps): Promise<OutboxItem> {
  let item = start;
  while (item.status === 'pending') {
    const current: PendingItem = item;
    try {
      item = { ...(await advance(current, deps)), updatedAt: deps.now() };
      if (item.status === 'pending') {
        await deps.save(item);
      }
    } catch (error) {
      const now = deps.now();
      if (isServerRefusal(error)) {
        return refused(current, error, now);
      }
      const attempts = current.attempts + 1;
      return { ...current, attempts, nextAttemptAt: now + backoff(attempts), updatedAt: now };
    }
  }
  return item;
}

const STAGES: readonly OutboxStage[] = ['queued', 'created', 'uploaded', 'attached', 'submitted'];
const isStage = (value: unknown): value is OutboxStage => STAGES.some((stage) => stage === value);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

/**
 * One saved item, checked where it comes off the disk. Earlier versions saved stage and status as
 * two loose fields, so a saved item may hold a combination the union rules out (a created item
 * without its expense id, an upload without its storage id). Each is moved back to the last stage
 * it can resume from; the server's clientRef replay makes repeating a step safe.
 */
function readItem(saved: unknown): OutboxItem | null {
  if (!isRecord(saved) || !text(saved.id) || !isRecord(saved.draft) || !isRecord(saved.receipt)) {
    return null;
  }
  const {
    expenseId: savedExpenseId,
    problem: savedProblem,
    stage: savedStage,
    status: savedStatus,
    storageId: savedStorageId,
    ...rest
  } = saved as unknown as OutboxBase & Record<'expenseId' | 'problem' | 'stage' | 'status' | 'storageId', unknown>;
  const expenseId = text(savedExpenseId);
  const storageId = text(savedStorageId);
  const stage = isStage(savedStage) ? savedStage : 'queued';

  if (savedStatus === 'done') {
    return expenseId ? { ...rest, expenseId, stage: 'submitted', status: 'done' } : null;
  }
  let step: OutboxStep;
  if (!expenseId || stage === 'queued') step = { stage: 'queued' };
  else if (stage === 'uploaded' && storageId) step = { expenseId, stage, storageId };
  else if (stage === 'uploaded') step = { expenseId, stage: 'created' };
  else step = { expenseId, stage };

  if (savedStatus === 'needsAttention') {
    const problem = text(savedProblem) ?? UNKNOWN_REFUSAL;
    // A refused upload's file is gone from the server, so it starts again from `created`.
    return step.stage === 'uploaded'
      ? { ...rest, expenseId: step.expenseId, problem, stage: 'created', status: 'needsAttention' }
      : { ...rest, ...step, problem, status: 'needsAttention' };
  }
  return { ...rest, ...step, status: 'pending' };
}

/** The saved outbox as typed items. Anything unreadable is left out rather than crashing the tab. */
export function readOutbox(saved: unknown): OutboxItem[] {
  if (!Array.isArray(saved)) return [];
  return saved.map(readItem).filter((item): item is OutboxItem => item !== null);
}
