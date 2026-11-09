import { ConvexError } from 'convex/values';

import { syncedAt as landedAt } from './fixtures';
import {
  discardRefused,
  drainSyncQueue,
  dueSyncItems,
  enqueuePush,
  type FieldPush,
  type PushOutcome,
  pushOf,
  readSyncItems,
  retrySyncNow,
  sendItem,
  settleItem,
  type SyncDeps,
  syncedLabel,
  syncKey,
  type SyncItem,
  syncSummary,
} from './queue';

const NOW = 1_000_000;
type StopPush = Extract<FieldPush, { kind: 'headcountStop' }>;

function stop(present: string[], clientUpdatedAt: number): StopPush {
  return {
    args: {
      clientStopId: 'stop-1',
      clientUpdatedAt,
      day: '2026-11-06',
      jobCardId: 'jc_1',
      label: 'Start of day',
      presentTravellerIds: present,
      startedAt: NOW,
    },
    kind: 'headcountStop',
  };
}

function deps(answer: SyncDeps['push']): SyncDeps & { sent: FieldPush[] } {
  const sent: FieldPush[] = [];
  return {
    now: () => NOW + 10,
    push: async (push) => {
      sent.push(push);
      return answer(push);
    },
    sent,
  };
}

const applied = async () => ({ applied: true, id: 'srv_1', ignoredTravellerIds: 0 });

/** Narrows to a pending item, failing the test if it is in another state. */
function pendingOnly(item: SyncItem) {
  if (item.status !== 'pending') throw new Error(`expected pending, got ${item.status}`);
  return item;
}

describe('field sync queue', () => {
  it('keeps one item per stop, holding only the latest state', () => {
    let items: SyncItem[] = [];
    items = enqueuePush(items, stop(['t_1'], NOW), 'staff_1', NOW);
    items = enqueuePush(items, stop(['t_1', 't_2'], NOW + 1), 'staff_1', NOW + 1);
    items = enqueuePush(items, { ...stop([], NOW), args: { ...stop([], NOW).args, clientStopId: 'stop-2' } }, 'staff_1', NOW + 2);
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.key === syncKey(stop([], 0)))?.args).toMatchObject({ presentTravellerIds: ['t_1', 't_2'] });
  });

  it('never replaces a newer queued state with an older one', () => {
    const newer = enqueuePush([], stop(['t_1', 't_2'], NOW + 5), 'staff_1', NOW);
    expect(enqueuePush(newer, stop(['t_1'], NOW), 'staff_1', NOW + 6)).toBe(newer);
  });

  it('sends only the latest state after several offline changes', async () => {
    let items: SyncItem[] = [];
    for (const [index, present] of [['t_1'], ['t_1', 't_2'], ['t_2']].entries()) {
      items = enqueuePush(items, stop(present, NOW + index), 'staff_1', NOW + index);
    }
    const fake = deps(applied);
    for (const item of dueSyncItems(items, NOW + 10, 'staff_1')) {
      await sendItem(item, fake);
    }
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]?.args).toMatchObject({ clientUpdatedAt: NOW + 2, presentTravellerIds: ['t_2'] });
  });

  it("is tied to the staff member who queued it: nobody sends another's", () => {
    const mine = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    const both = enqueuePush(mine, stop(['t_9'], NOW + 1), 'staff_2', NOW + 1);
    expect(both).toHaveLength(2);
    expect(dueSyncItems(both, NOW + 1, 'staff_1').map((item) => item.staffId)).toEqual(['staff_1']);
    expect(dueSyncItems(both, NOW + 1, 'staff_2')[0]?.args).toMatchObject({ presentTravellerIds: ['t_9'] });
    expect(dueSyncItems(both, NOW, 'staff_3')).toEqual([]);
  });

  it('marks the item synced with the time the office confirmed it', async () => {
    const [item] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!item) throw new Error('no item');
    const outcome = await sendItem(item, deps(async () => ({ applied: true, id: 'srv_1', ignoredTravellerIds: 2 })));
    const settled = settleItem(item, item, outcome);
    expect(settled).toMatchObject({ landed: { at: NOW + 10, ignoredTravellerIds: 2, newerOnServer: false }, status: 'synced' });
    // A synced item carries no retry schedule.
    expect(settled).not.toHaveProperty('attempts');
    expect(settled).not.toHaveProperty('nextAttemptAt');
  });

  it('treats applied: false as synced: the office already holds a newer copy, so it stops sending', async () => {
    const [item] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!item) throw new Error('no item');
    const outcome = await sendItem(item, deps(async () => ({ applied: false, id: 'srv_1', ignoredTravellerIds: 0 })));
    const settled = settleItem(item, item, outcome);
    expect(settled).toMatchObject({ landed: { newerOnServer: true }, status: 'synced' });
    expect(dueSyncItems([settled], NOW + 10 ** 9, 'staff_1')).toEqual([]);
  });

  it('retries a network failure with growing backoff and keeps the state', async () => {
    const [item] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!item) throw new Error('no item');
    const offline = deps(async () => {
      throw new TypeError('Network request failed');
    });
    const first = pendingOnly(settleItem(item, item, await sendItem(item, offline)));
    expect(first.attempts).toBe(1);
    expect(first.nextAttemptAt).toBeGreaterThan(NOW + 10);
    expect(dueSyncItems([first], NOW + 10, 'staff_1')).toEqual([]);

    const second = pendingOnly(settleItem(first, first, await sendItem(first, { ...offline, now: () => first.nextAttemptAt })));
    expect(second.attempts).toBe(2);
    expect(second.nextAttemptAt - first.nextAttemptAt).toBeGreaterThan(first.nextAttemptAt - (NOW + 10));
    expect(second.args).toEqual(item.args);
  });

  it('stops on a server refusal and explains it, until the tour manager retries', async () => {
    const [item] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!item) throw new Error('no item');
    const refused = settleItem(item, item, await sendItem(item, deps(async () => Promise.reject(new ConvexError('FORBIDDEN')))));
    expect(refused).toMatchObject({ problem: expect.stringMatching(/no longer be assigned/), status: 'needsAttention' });
    expect(refused).not.toHaveProperty('nextAttemptAt');
    expect(dueSyncItems([refused], NOW + 10 ** 9, 'staff_1')).toEqual([]);
    const retried = retrySyncNow(refused, NOW);
    expect(dueSyncItems([retried], NOW, 'staff_1')).toHaveLength(1);
    // A retried item is pending again: the refusal's words go with the refusal.
    expect(retried).not.toHaveProperty('problem');
  });

  it('lets the tour manager stop sending a refused item, and only a refused one', async () => {
    const [item] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!item) throw new Error('no item');
    const refused = settleItem(item, item, await sendItem(item, deps(async () => Promise.reject(new ConvexError('FORBIDDEN')))));
    const other = enqueuePush([], { ...stop(['t_2'], NOW), args: { ...stop(['t_2'], NOW).args, clientStopId: 'stop-2' } }, 'staff_1', NOW);
    const queued = [refused, ...other];
    expect(discardRefused(queued, [refused.key], 'staff_2')).toEqual(queued);
    expect(discardRefused(queued, [refused.key], 'staff_1')).toEqual(other);
    // A pending item is still on its way: discarding it is not offered, and not done.
    expect(discardRefused(other, other.map((entry) => entry.key), 'staff_1')).toEqual(other);
  });

  it('reads items saved before the explicit states, with their flags turned into one state', () => {
    const push = stop(['t_1'], NOW);
    const [item] = enqueuePush([], push, 'staff_1', NOW);
    if (!item) throw new Error('no item');
    const legacy = { ...push, attempts: 0, ignoredTravellerIds: 1, key: item.key, newerOnServer: false, nextAttemptAt: NOW, staffId: 'staff_1', updatedAt: NOW };
    const [synced, refused, waiting] = readSyncItems([
      { ...legacy, status: 'synced', syncedAt: NOW + 5 },
      { ...legacy, problem: 'No', status: 'needsAttention' },
      { ...legacy, attempts: 2, status: 'pending' },
    ]);
    expect(synced).toEqual({ args: item.args, key: item.key, kind: item.kind, landed: { at: NOW + 5, ignoredTravellerIds: 1, newerOnServer: false }, staffId: 'staff_1', status: 'synced', updatedAt: NOW });
    expect(refused).toMatchObject({ problem: 'No', status: 'needsAttention' });
    expect(refused?.landed).toBeUndefined();
    expect(waiting).toMatchObject({ attempts: 2, nextAttemptAt: NOW, status: 'pending' });
    expect(readSyncItems([item])).toEqual([item]);
    expect(readSyncItems(null)).toEqual([]);
  });

  it('keeps a change made while a push was in flight queued, instead of marking it synced', async () => {
    const [sent] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!sent) throw new Error('no item');
    const outcome = await sendItem(sent, deps(applied));
    const [changed] = enqueuePush([sent], stop(['t_1', 't_2'], NOW + 3), 'staff_1', NOW + 3);
    if (!changed) throw new Error('no item');
    const settled = settleItem(changed, sent, outcome);
    expect(settled).toMatchObject({ landed: { at: NOW + 10 }, status: 'pending' });
    expect(settled.args).toMatchObject({ presentTravellerIds: ['t_1', 't_2'] });
  });

  it('drops synced items after a few days so the queue stays small', () => {
    const [item] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!item) throw new Error('no item');
    const old = landedAt(item, NOW);
    const later = NOW + 4 * 24 * 60 * 60 * 1000;
    const other: FieldPush = { ...stop([], later), args: { ...stop([], later).args, clientStopId: 'stop-9' } };
    expect(enqueuePush([old], other, 'staff_1', later).map((entry) => entry.args)).toEqual([other.args]);
  });

  it('summarises a set of items for the screen', () => {
    const [item] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!item) throw new Error('no item');
    expect(syncSummary([])).toEqual({ kind: 'none' });
    expect(syncSummary([item])).toEqual({ kind: 'waiting' });
    const synced = landedAt(item, NOW + 5, 1);
    expect(syncSummary([synced])).toEqual({ at: NOW + 5, ignored: 1, kind: 'synced', newerOnServer: false });
    expect(syncSummary([synced, { ...pushOf(item), key: 'other', problem: 'No', staffId: 'staff_1', status: 'needsAttention', updatedAt: NOW }])).toEqual({
      keys: ['other'],
      kind: 'problem',
      problem: 'No',
    });
  });

  it('labels the sync time like the trip pack: time today, date and time on an earlier day', () => {
    // The test runner's own locale is en-US, like a US phone: the label must not follow it.
    const format = { timeZone: 'UTC' };
    const at = Date.UTC(2026, 10, 6, 7, 12);
    expect(syncedLabel(at, Date.UTC(2026, 10, 6, 9, 0), format)).toBe('Synced to office 07:12');
    expect(syncedLabel(at, Date.UTC(2026, 10, 7, 9, 0), format)).toBe('Synced to office 6 Nov, 07:12');
  });

  describe('a run over the queue', () => {
    /** A queue that settles like the provider does: the outcome is applied to the item as it is now. */
    function queue(initial: SyncItem[]) {
      const state = { items: initial };
      const settle = async (sent: SyncItem, outcome: PushOutcome) => {
        state.items = state.items.map((item) => (item.key === sent.key && item.staffId === sent.staffId ? settleItem(item, sent, outcome) : item));
      };
      return { settle, state };
    }
    const presentIn = (push: FieldPush) => (push.kind === 'headcountStop' ? push.args.presentTravellerIds : []);
    const second = (present: string[], at: number): StopPush => ({ ...stop(present, at), args: { ...stop(present, at).args, clientStopId: 'stop-2' } });

    it("sends this staff member's due items one at a time and settles each", async () => {
      const mine = enqueuePush(enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW), second(['t_2'], NOW), 'staff_1', NOW);
      const { settle, state } = queue(enqueuePush(mine, stop(['t_9'], NOW), 'staff_2', NOW));
      const fake = deps(applied);
      await drainSyncQueue({ deps: fake, isCurrent: () => true, queued: () => state.items, settle, staffId: 'staff_1' });
      expect(fake.sent.map(presentIn)).toEqual([['t_1'], ['t_2']]);
      expect(state.items.map((item) => `${item.staffId}:${item.status}`)).toEqual(['staff_1:synced', 'staff_1:synced', 'staff_2:pending']);
    });

    it('stops without settling anything once the store is wiped', async () => {
      const { settle, state } = queue(enqueuePush(enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW), second(['t_2'], NOW), 'staff_1', NOW));
      let current = true;
      const fake = deps(async () => {
        current = false;
        return applied();
      });
      await drainSyncQueue({ deps: fake, isCurrent: () => current, queued: () => state.items, settle, staffId: 'staff_1' });
      expect(fake.sent).toHaveLength(1);
      expect(state.items.map((item) => item.status)).toEqual(['pending', 'pending']);
    });
  });
});
