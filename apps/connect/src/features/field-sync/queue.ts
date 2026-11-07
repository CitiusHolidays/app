import type { AnnouncementArgs, FieldPushResult, HeadcountStopArgs } from '@citius/backend';

import { isServerRefusal } from '@/features/expenses/outbox';
import type { FreshnessFormat } from '@/features/trip-pack/trip-pack';

/**
 * Headcount stops and announcements waiting to reach the office. The phone is the record: each
 * change replaces the queued state for that stop or announcement, so only the latest is sent,
 * and the server upserts on the client id, so sending the same state twice is harmless.
 */

export type FieldPush =
  | { args: HeadcountStopArgs; kind: 'headcountStop' }
  | { args: AnnouncementArgs; kind: 'announcement' };

export type SyncStatus = 'pending' | 'synced' | 'needsAttention';

export type SyncItem = FieldPush & {
  attempts: number;
  /** From the last push that landed: traveller ids the server left out of its record. */
  ignoredTravellerIds: number;
  key: string;
  /** The last push landed with `applied: false`: the office already had a newer copy. */
  newerOnServer: boolean;
  nextAttemptAt: number;
  /** Plain words for the tour manager, set when the server refused the push. */
  problem?: string;
  /** The staff member who queued it; only they may send it. */
  staffId: string;
  status: SyncStatus;
  /** When the office last confirmed a push for this key. */
  syncedAt?: number;
  updatedAt: number;
};

export type PushOutcome =
  | { at: number; ignored: number; kind: 'applied' | 'stale' }
  | { at: number; kind: 'refused'; problem: string }
  | { at: number; kind: 'retry' };

export interface SyncDeps {
  now: () => number;
  push: (push: FieldPush) => Promise<FieldPushResult>;
}

export type SyncSummary =
  | { kind: 'none' }
  | { kind: 'waiting' }
  | { at: number; ignored: number; kind: 'synced'; newerOnServer: boolean }
  | { keys: string[]; kind: 'problem'; problem: string };

export const fieldOutboxKey = 'outbox:field';
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 30 * 60_000;
const KEEP_SYNCED_MS = 3 * 24 * 60 * 60 * 1000;

export function syncKey(push: FieldPush) {
  return push.kind === 'headcountStop'
    ? `headcountStop:${push.args.jobCardId}:${push.args.clientStopId}`
    : `announcement:${push.args.jobCardId}:${push.args.clientAnnouncementId}`;
}

const version = (push: FieldPush) => push.args.clientUpdatedAt ?? 0;
const sameState = (left: FieldPush, right: FieldPush) => JSON.stringify(left.args) === JSON.stringify(right.args);

/**
 * Queues the state to send, replacing anything queued for the same key by the same staff member.
 * An older state never replaces a newer one. Synced items older than a few days are dropped.
 */
export function enqueuePush(items: SyncItem[], push: FieldPush, staffId: string, now: number): SyncItem[] {
  const key = syncKey(push);
  const mine = (item: SyncItem) => item.key === key && item.staffId === staffId;
  const existing = items.find(mine);
  if (existing && version(existing) > version(push)) {
    return items;
  }
  const kept = items.filter((item) => !mine(item) && !(item.status === 'synced' && now - item.updatedAt > KEEP_SYNCED_MS));
  const next = {
    ...push,
    attempts: 0,
    ignoredTravellerIds: existing?.ignoredTravellerIds ?? 0,
    key,
    newerOnServer: false,
    nextAttemptAt: now,
    staffId,
    status: 'pending',
    updatedAt: now,
    ...(existing?.syncedAt === undefined ? {} : { syncedAt: existing.syncedAt }),
  } as SyncItem;
  return [...kept, next];
}

/** Pending items whose time has come, queued by this staff member. */
export function dueSyncItems(items: SyncItem[], now: number, staffId: string) {
  return items.filter((item) => item.staffId === staffId && item.status === 'pending' && item.nextAttemptAt <= now);
}

export function retrySyncNow(item: SyncItem, now: number): SyncItem {
  const { problem: _problem, ...rest } = item;
  return { ...rest, attempts: 0, nextAttemptAt: now, status: 'pending', updatedAt: now } as SyncItem;
}

/** Known server refusals, in words a tour manager can act on. Server text is never shown raw. */
const KNOWN_REFUSALS: [RegExp, string][] = [
  [/APP_PILOT_OFF/, 'This trip is not live in the app any more, so the office did not record this. Tell Operations.'],
  [/forbidden|must belong to the selected job card/i, 'The office did not accept this: the trip or batch may no longer be assigned to you.'],
  [/more travellers than|too many travellers/i, 'This trip is too large to send from the app. Tell Operations.'],
  [/1 to 4000 characters/i, 'This message is too long for the office record (4,000 characters at most).'],
  [/cannot change after it is sent|cannot move to another day/i, 'The office already holds a different version of this. Tell Operations.'],
  [/staff record/i, 'Your account has no staff record, so the office cannot record this.'],
];

function refusalMessage(error: unknown) {
  const text = typeof (error as { data?: unknown })?.data === 'string' ? (error as { data: string }).data : '';
  return KNOWN_REFUSALS.find(([pattern]) => pattern.test(text))?.[1] ?? 'The office did not accept this update. Refresh the trip, then try again.';
}

function backoff(attempts: number) {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

/** Sends one item. Never throws: a server answer, a refusal or a retry. */
export async function sendItem(item: SyncItem, deps: SyncDeps): Promise<PushOutcome> {
  try {
    const result = await deps.push(item);
    return { at: deps.now(), ignored: result.ignoredTravellerIds, kind: result.applied ? 'applied' : 'stale' };
  } catch (error) {
    const at = deps.now();
    return isServerRefusal(error) ? { at, kind: 'refused', problem: refusalMessage(error) } : { at, kind: 'retry' };
  }
}

/**
 * One run over the queue: sends this staff member's due items one at a time and settles each.
 * Sequential on purpose: a stop's later state must not race its earlier one to the office, and a
 * sign-out (`isCurrent` turning false) must stop the run before its next request. `again` is set
 * by a run requested while this one was busy; the queue is read afresh before stopping.
 */
export async function drainSyncQueue(run: {
  again: { current: boolean };
  deps: SyncDeps;
  isCurrent: () => boolean;
  queued: () => SyncItem[];
  settle: (sent: SyncItem, outcome: PushOutcome) => Promise<void>;
  staffId: string;
}) {
  do {
    run.again.current = false;
    for (const item of dueSyncItems(run.queued(), run.deps.now(), run.staffId)) {
      if (!run.isCurrent()) return;
      const outcome = await sendItem(item, run.deps);
      if (!run.isCurrent()) return;
      await run.settle(item, outcome);
    }
  } while (run.again.current && run.isCurrent());
}

/**
 * Applies the outcome of sending `sent` to the item as it is now. If the tour manager changed the
 * stop or checklist while the push was in flight, the newer state stays queued.
 */
export function settleItem(current: SyncItem, sent: SyncItem, outcome: PushOutcome): SyncItem {
  if (outcome.kind === 'retry') {
    const attempts = current.attempts + 1;
    return { ...current, attempts, nextAttemptAt: outcome.at + backoff(attempts), updatedAt: outcome.at };
  }
  const changedSince = !sameState(current, sent);
  if (outcome.kind === 'refused') {
    // A newer state may well be accepted (a shorter message, say); let it try.
    return changedSince ? current : { ...current, problem: outcome.problem, status: 'needsAttention', updatedAt: outcome.at };
  }
  const landed = { ...current, ignoredTravellerIds: outcome.ignored, newerOnServer: outcome.kind === 'stale', syncedAt: outcome.at };
  return changedSince ? landed : { ...landed, attempts: 0, status: 'synced', updatedAt: outcome.at };
}

/** One state for a group of items (today's stops, say): a problem first, then waiting, then synced. */
export function syncSummary(items: SyncItem[]): SyncSummary {
  if (items.length === 0) {
    return { kind: 'none' };
  }
  const stuck = items.filter((item) => item.status === 'needsAttention');
  if (stuck.length > 0) {
    return { keys: stuck.map((item) => item.key), kind: 'problem', problem: stuck[0]?.problem ?? '' };
  }
  if (items.some((item) => item.status === 'pending')) {
    return { kind: 'waiting' };
  }
  const latest = [...items].sort((left, right) => (right.syncedAt ?? 0) - (left.syncedAt ?? 0))[0];
  return {
    at: latest?.syncedAt ?? 0,
    ignored: latest?.ignoredTravellerIds ?? 0,
    kind: 'synced',
    newerOnServer: items.some((item) => item.newerOnServer),
  };
}

function sameLocalDay(left: number, right: number, timeZone?: string) {
  const day = new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', timeZone, year: 'numeric' });
  return day.format(left) === day.format(right);
}

/** "Synced to office 07:12", with the date added when that was on an earlier day. */
export function syncedLabel(at: number, now: number, format: FreshnessFormat = {}) {
  const time = new Intl.DateTimeFormat(format.locale, { hour: '2-digit', hourCycle: 'h23', minute: '2-digit', timeZone: format.timeZone }).format(at);
  if (sameLocalDay(at, now, format.timeZone)) {
    return `Synced to office ${time}`;
  }
  const day = new Intl.DateTimeFormat(format.locale, { day: 'numeric', month: 'short', timeZone: format.timeZone }).format(at);
  return `Synced to office ${day}, ${time}`;
}
