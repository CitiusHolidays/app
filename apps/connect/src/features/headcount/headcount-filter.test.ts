import type { RosterEntry } from '@/features/trip-pack/trip-pack';

import { EVERYONE, viewRoster } from './headcount-filter';

function entry(id: string, batchId: string, travelling = true): RosterEntry {
  return { batchId, batchLabel: batchId, callingStatus: '', guestType: 'Client', id, name: `Name ${id}`, passportStatus: '', phone: '', travelling, visaStatus: '' };
}

const pack = {
  batches: [
    { id: 'b1', label: 'Bus 1' },
    { id: 'b2', label: 'Bus 2' },
    { id: 'b3', label: 'Bus 3' },
  ],
  roster: [entry('a', 'b1'), entry('b', 'b1'), entry('c', 'b2'), entry('d', 'b3', false)],
};
const ids = (view: ReturnType<typeof viewRoster>) => view.people.map((person) => person.id);

describe('headcount filter', () => {
  it('shows everyone travelling, or one batch, or only who is not marked', () => {
    const present = new Set(['a']);
    expect(ids(viewRoster(pack, EVERYONE, present))).toEqual(['a', 'b', 'c']);
    expect(ids(viewRoster(pack, { batchId: 'b1', show: 'all' }, present))).toEqual(['a', 'b']);
    expect(ids(viewRoster(pack, { batchId: null, show: 'missing' }, present))).toEqual(['b', 'c']);
  });

  it('keeps a just-marked row in "Not marked" while it is held', () => {
    expect(ids(viewRoster(pack, { batchId: null, show: 'missing' }, new Set(['a']), new Set(['a'])))).toEqual(['a', 'b', 'c']);
  });

  it('names the batch in the empty copy only when one is chosen', () => {
    const everyone = new Set(['a', 'b', 'c']);
    expect(viewRoster(pack, { batchId: null, show: 'missing' }, everyone).empty).toEqual({ good: true, text: 'Everyone here is marked.' });
    expect(viewRoster(pack, { batchId: 'b2', show: 'missing' }, everyone).empty).toEqual({ good: true, text: 'Everyone in Bus 2 is marked.' });
    expect(viewRoster(pack, { batchId: 'b3', show: 'all' }, everyone).empty).toEqual({ good: false, text: 'Nobody in Bus 3 is travelling.' });
    expect(viewRoster(pack, EVERYONE, new Set()).empty).toBeNull();
  });

  it('falls back to everyone when the chosen batch is no longer in the pack', () => {
    const view = viewRoster(pack, { batchId: 'gone', show: 'all' }, new Set());
    expect(view.batch).toBeNull();
    expect(ids(view)).toEqual(['a', 'b', 'c']);
  });
});
