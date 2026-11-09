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

/** What the office said about the last push of this key that landed. */
interface OfficeCopy {
  at: number;
  /** Traveller ids the server left out of its record. */
  ignoredTravellerIds: number;
  /** The push landed with `applied: false`: the office already had a newer copy. */
  newerOnServer: boolean;
}

/**
 * Where one queued item stands. Only a pending item has a retry schedule, only a refused one has a
 * problem, and a synced one always knows when it landed. A pending or refused item may still
 * remember an earlier landing: the stop changed after the office had it.
 */
type SyncState =
  | { attempts: number; landed?: OfficeCopy; nextAttemptAt: number; status: 'pending' }
  | { landed: OfficeCopy; status: 'synced' }
  | {
      landed?: OfficeCopy;
      /** Plain words for the tour manager: why the office refused it. */
      problem: string;
      status: 'needsAttention';
    };

type SyncStatus = SyncState['status'];

interface SyncIdentity {
  key: string;
  /** The staff member who queued it; only they may send it. */
  staffId: string;
  updatedAt: number;
}

export type SyncItem = FieldPush & SyncState & SyncIdentity;

/** An item as earlier versions saved it, with the state spread over side-by-side flags. */
interface LegacySyncItem extends SyncIdentity {
  args: FieldPush['args'];
  attempts: number;
  ignoredTravellerIds: number;
  kind: FieldPush['kind'];
  newerOnServer: boolean;
  nextAttemptAt: number;
  problem?: string;
  status: SyncStatus;
  syncedAt?: number;
}

/** What the store may hold under `fieldOutboxKey`. */
export type StoredSyncItem = SyncItem | LegacySyncItem;

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
const UNKNOWN_REFUSAL = 'The office did not accept this update. Refresh the trip, then try again.';

export function syncKey(push: FieldPush) {
  return push.kind === 'headcountStop'
    ? `headcountStop:${push.args.jobCardId}:${push.args.clientStopId}`
    : `announcement:${push.args.jobCardId}:${push.args.clientAnnouncementId}`;
}

const version = (push: FieldPush) => push.args.clientUpdatedAt ?? 0;
const sameState = (left: FieldPush, right: FieldPush) => JSON.stringify(left.args) === JSON.stringify(right.args);

/** The push itself, without its queue state. */
function pushOf(item: FieldPush): FieldPush {
  return item.kind === 'headcountStop' ? { args: item.args, kind: item.kind } : { args: item.args, kind: item.kind };
}

const identity = (item: SyncIdentity, now: number): SyncIdentity => ({ key: item.key, staffId: item.staffId, updatedAt: now });

/** Due now, from the first attempt. */
function pending(push: FieldPush, id: SyncIdentity, landed: OfficeCopy | undefined): SyncItem {
  return { ...pushOf(push), ...id, attempts: 0, landed, nextAttemptAt: id.updatedAt, status: 'pending' };
}

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
  return [...kept, pending(push, { key, staffId, updatedAt: now }, existing?.landed)];
}

/** Pending items whose time has come, queued by this staff member. */
export function dueSyncItems(items: SyncItem[], now: number, staffId: string) {
  return items.filter((item) => item.staffId === staffId && item.status === 'pending' && item.nextAttemptAt <= now);
}

export function retrySyncNow(item: SyncItem, now: number): SyncItem {
  return pending(item, identity(item, now), item.landed);
}

/**
 * Drops the refused items with these keys: the tour manager chose to stop sending them. The record
 * stays on the phone, and a later change to it queues it again. Items still on their way are kept.
 */
export function discardRefused(items: SyncItem[], keys: readonly string[], staffId: string): SyncItem[] {
  const discarded = new Set(keys);
  return items.filter((item) => !(item.staffId === staffId && item.status === 'needsAttention' && discarded.has(item.key)));
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
  return KNOWN_REFUSALS.find(([pattern]) => pattern.test(text))?.[1] ?? UNKNOWN_REFUSAL;
}

function backoff(attempts: number) {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

/** Sends one item. Never throws: a server answer, a refusal or a retry. */
export async function sendItem(item: SyncItem, deps: SyncDeps): Promise<PushOutcome> {
  try {
    const result = await deps.push(pushOf(item));
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
    if (current.status !== 'pending') return current;
    const attempts = current.attempts + 1;
    return { ...current, attempts, nextAttemptAt: outcome.at + backoff(attempts), updatedAt: outcome.at };
  }
  const changedSince = !sameState(current, sent);
  if (outcome.kind === 'refused') {
    // A newer state may well be accepted (a shorter message, say); let it try.
    if (changedSince) return current;
    return { ...pushOf(current), ...identity(current, outcome.at), landed: current.landed, problem: outcome.problem, status: 'needsAttention' };
  }
  const landed: OfficeCopy = { at: outcome.at, ignoredTravellerIds: outcome.ignored, newerOnServer: outcome.kind === 'stale' };
  // A newer state stays queued, and remembers what the office now holds.
  if (changedSince) return { ...current, landed };
  return { ...pushOf(current), ...identity(current, outcome.at), landed, status: 'synced' };
}

/** One state for a group of items (today's stops, say): a problem first, then waiting, then synced. */
export function syncSummary(items: SyncItem[]): SyncSummary {
  if (items.length === 0) {
    return { kind: 'none' };
  }
  const stuck = items.filter((item) => item.status === 'needsAttention');
  if (stuck.length > 0) {
    return { keys: stuck.map((item) => item.key), kind: 'problem', problem: stuck[0]?.problem ?? UNKNOWN_REFUSAL };
  }
  const landed = items.flatMap((item) => (item.status === 'synced' ? [item.landed] : []));
  const latest = landed.reduce<OfficeCopy | null>((newest, copy) => (newest && newest.at >= copy.at ? newest : copy), null);
  if (!latest || landed.length < items.length) {
    return { kind: 'waiting' };
  }
  return { at: latest.at, ignored: latest.ignoredTravellerIds, kind: 'synced', newerOnServer: landed.some((copy) => copy.newerOnServer) };
}

/**
 * Reads the queue as stored. Items saved before the explicit states are converted here, at the
 * storage boundary, so nothing past it sees side-by-side flags.
 */
export function readSyncItems(stored: readonly StoredSyncItem[] | null | undefined): SyncItem[] {
  return (stored ?? []).map((item) => ('newerOnServer' in item ? fromLegacy(item) : item));
}

function fromLegacy(item: LegacySyncItem): SyncItem {
  const id: SyncIdentity = { key: item.key, staffId: item.staffId, updatedAt: item.updatedAt };
  const push = pushOf({ args: item.args, kind: item.kind } as FieldPush);
  const office = (at: number): OfficeCopy => ({ at, ignoredTravellerIds: item.ignoredTravellerIds, newerOnServer: item.newerOnServer });
  const landed = item.syncedAt === undefined ? undefined : office(item.syncedAt);
  if (item.status === 'synced') {
    return { ...push, ...id, landed: landed ?? office(item.updatedAt), status: 'synced' };
  }
  if (item.status === 'needsAttention') {
    return { ...push, ...id, landed, problem: item.problem ?? UNKNOWN_REFUSAL, status: 'needsAttention' };
  }
  return { ...push, ...id, attempts: item.attempts, landed, nextAttemptAt: item.nextAttemptAt, status: 'pending' };
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
