import { ConvexError } from 'convex/values';

import {
  drainSyncQueue,
  dueSyncItems,
  enqueuePush,
  type FieldPush,
  type PushOutcome,
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
    expect(settleItem(item, item, outcome)).toMatchObject({ ignoredTravellerIds: 2, newerOnServer: false, status: 'synced', syncedAt: NOW + 10 });
  });

  it('treats applied: false as synced: the office already holds a newer copy, so it stops sending', async () => {
    const [item] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!item) throw new Error('no item');
    const outcome = await sendItem(item, deps(async () => ({ applied: false, id: 'srv_1', ignoredTravellerIds: 0 })));
    const settled = settleItem(item, item, outcome);
    expect(settled).toMatchObject({ newerOnServer: true, status: 'synced' });
    expect(dueSyncItems([settled], NOW + 10 ** 9, 'staff_1')).toEqual([]);
  });

  it('retries a network failure with growing backoff and keeps the state', async () => {
    const [item] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!item) throw new Error('no item');
    const offline = deps(async () => {
      throw new TypeError('Network request failed');
    });
    const first = settleItem(item, item, await sendItem(item, offline));
    expect(first).toMatchObject({ attempts: 1, status: 'pending' });
    expect(first.nextAttemptAt).toBeGreaterThan(NOW + 10);
    expect(dueSyncItems([first], NOW + 10, 'staff_1')).toEqual([]);

    const second = settleItem(first, first, await sendItem(first, { ...offline, now: () => first.nextAttemptAt }));
    expect(second.attempts).toBe(2);
    expect(second.nextAttemptAt - first.nextAttemptAt).toBeGreaterThan(first.nextAttemptAt - (NOW + 10));
    expect(second.args).toEqual(item.args);
  });

  it('stops on a server refusal and explains it, until the tour manager retries', async () => {
    const [item] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!item) throw new Error('no item');
    const refused = settleItem(item, item, await sendItem(item, deps(async () => Promise.reject(new ConvexError('FORBIDDEN')))));
    expect(refused).toMatchObject({ status: 'needsAttention' });
    expect(refused.problem).toMatch(/no longer be assigned/);
    expect(dueSyncItems([refused], NOW + 10 ** 9, 'staff_1')).toEqual([]);
    expect(dueSyncItems([retrySyncNow(refused, NOW)], NOW, 'staff_1')).toHaveLength(1);
  });

  it('keeps a change made while a push was in flight queued, instead of marking it synced', async () => {
    const [sent] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!sent) throw new Error('no item');
    const outcome = await sendItem(sent, deps(applied));
    const [changed] = enqueuePush([sent], stop(['t_1', 't_2'], NOW + 3), 'staff_1', NOW + 3);
    if (!changed) throw new Error('no item');
    const settled = settleItem(changed, sent, outcome);
    expect(settled).toMatchObject({ status: 'pending', syncedAt: NOW + 10 });
    expect(settled.args).toMatchObject({ presentTravellerIds: ['t_1', 't_2'] });
  });

  it('drops synced items after a few days so the queue stays small', () => {
    const [item] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!item) throw new Error('no item');
    const old: SyncItem = { ...item, status: 'synced', syncedAt: NOW, updatedAt: NOW };
    const later = NOW + 4 * 24 * 60 * 60 * 1000;
    const other: FieldPush = { ...stop([], later), args: { ...stop([], later).args, clientStopId: 'stop-9' } };
    expect(enqueuePush([old], other, 'staff_1', later).map((entry) => entry.args)).toEqual([other.args]);
  });

  it('summarises a set of items for the screen', () => {
    const [item] = enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW);
    if (!item) throw new Error('no item');
    expect(syncSummary([])).toEqual({ kind: 'none' });
    expect(syncSummary([item])).toEqual({ kind: 'waiting' });
    const synced: SyncItem = { ...item, ignoredTravellerIds: 1, status: 'synced', syncedAt: NOW + 5 };
    expect(syncSummary([synced])).toEqual({ at: NOW + 5, ignored: 1, kind: 'synced', newerOnServer: false });
    expect(syncSummary([synced, { ...item, key: 'other', problem: 'No', status: 'needsAttention' }])).toEqual({
      keys: ['other'],
      kind: 'problem',
      problem: 'No',
    });
  });

  it('labels the sync time like the trip pack: time today, date and time on an earlier day', () => {
    const format = { locale: 'en-GB', timeZone: 'UTC' };
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
      await drainSyncQueue({ again: { current: false }, deps: fake, isCurrent: () => true, queued: () => state.items, settle, staffId: 'staff_1' });
      expect(fake.sent.map(presentIn)).toEqual([['t_1'], ['t_2']]);
      expect(state.items.map((item) => `${item.staffId}:${item.status}`)).toEqual(['staff_1:synced', 'staff_1:synced', 'staff_2:pending']);
    });

    it('looks at the queue again when a change arrives during the run', async () => {
      const { settle, state } = queue(enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW));
      const again = { current: false };
      const fake = deps(async (push) => {
        if (presentIn(push).length === 1) {
          // The tour manager marks another traveller while the first push is in flight.
          state.items = enqueuePush(state.items, stop(['t_1', 't_2'], NOW + 1), 'staff_1', NOW + 1);
          again.current = true;
        }
        return applied();
      });
      await drainSyncQueue({ again, deps: fake, isCurrent: () => true, queued: () => state.items, settle, staffId: 'staff_1' });
      expect(fake.sent.map(presentIn)).toEqual([['t_1'], ['t_1', 't_2']]);
      expect(state.items).toMatchObject([{ status: 'synced' }]);
    });

    it('stops without settling anything once the store is wiped', async () => {
      const { settle, state } = queue(enqueuePush(enqueuePush([], stop(['t_1'], NOW), 'staff_1', NOW), second(['t_2'], NOW), 'staff_1', NOW));
      let current = true;
      const fake = deps(async () => {
        current = false;
        return applied();
      });
      await drainSyncQueue({ again: { current: false }, deps: fake, isCurrent: () => current, queued: () => state.items, settle, staffId: 'staff_1' });
      expect(fake.sent).toHaveLength(1);
      expect(state.items.map((item) => item.status)).toEqual(['pending', 'pending']);
    });
  });
});
