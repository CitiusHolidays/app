import type { RosterEntry } from '@/features/trip-pack/trip-pack';

import { earlierStops, headcountAnswer, localDay, newStop, nobodyTravelling, startHeadcount, summarize, togglePresent } from './headcount';

function entry(id: string, batchId: string, travelling = true): RosterEntry {
  return { batchId, batchLabel: batchId, callingStatus: '', guestType: 'Client', id, name: `Name ${id}`, passportStatus: '', phone: '', travelling, visaStatus: '' };
}

const roster = [entry('a', 'b1'), entry('b', 'b1'), entry('c', 'b2'), entry('d', 'b2', false)];
const MORNING = new Date(2026, 10, 6, 7, 0).getTime();

describe('headcount', () => {
  it('starts each day with one stop and nobody marked', () => {
    const state = startHeadcount('jc1', MORNING);
    expect(state.day).toBe('2026-11-06');
    expect(summarize(state, roster)).toMatchObject({ expected: 3, present: 0 });
  });

  it('counts only travelling people and lists who is missing', () => {
    let state = startHeadcount('jc1', MORNING);
    state = togglePresent(state, 'a');
    state = togglePresent(state, 'c');
    const summary = summarize(state, roster);
    expect(summary.present).toBe(2);
    expect(summary.missing.map((m) => m.id)).toEqual(['b']);
    expect(headcountAnswer(summary)).toBe('2 of 3 here');
  });

  it('untoggles a mark and ignores the cancelled traveller', () => {
    let state = startHeadcount('jc1', MORNING);
    state = togglePresent(state, 'a');
    state = togglePresent(state, 'a');
    state = togglePresent(state, 'd');
    expect(summarize(state, roster).present).toBe(0);
  });

  it('filters by travel batch', () => {
    const state = togglePresent(startHeadcount('jc1', MORNING), 'a');
    expect(summarize(state, roster, 'b1')).toMatchObject({ expected: 2, present: 1 });
    expect(headcountAnswer(summarize(state, roster, 'b2'))).toBe('0 of 1 here');
  });

  it('resets marks for a new stop and keeps the earlier stop', () => {
    let state = togglePresent(startHeadcount('jc1', MORNING), 'a');
    state = newStop(state, 'Temple car park', MORNING + 3_600_000);
    expect(state.stops).toHaveLength(2);
    expect(state.stops[0]?.present).toEqual(['a']);
    expect(summarize(state, roster)).toMatchObject({ present: 0, stopLabel: 'Temple car park' });
  });

  it("lists today's earlier stops newest first, each counted against the whole group", () => {
    let state = togglePresent(startHeadcount('jc1', MORNING), 'a');
    state = newStop(state, 'Temple car park', MORNING + 1);
    state = togglePresent(togglePresent(state, 'b'), 'c');
    state = newStop(state, '', MORNING + 2);
    expect(earlierStops(state, roster)).toEqual([
      { answer: '2 of 3 here', id: `stop-${MORNING + 1}`, label: 'Temple car park', startedAt: MORNING + 1 },
      { answer: '1 of 3 here', id: `stop-${MORNING}`, label: 'Start of day', startedAt: MORNING },
    ]);
    expect(earlierStops(startHeadcount('jc1', MORNING), roster)).toEqual([]);
  });

  it('knows when nobody on the roster is travelling', () => {
    expect(nobodyTravelling(roster)).toBe(false);
    expect(nobodyTravelling([entry('d', 'b2', false)])).toBe(true);
    expect(nobodyTravelling([])).toBe(true);
  });

  it('says everyone is here when nobody is missing', () => {
    let state = startHeadcount('jc1', MORNING);
    for (const id of ['a', 'b', 'c']) state = togglePresent(state, id);
    expect(headcountAnswer(summarize(state, roster))).toBe('All 3 here');
  });

  it('never says everyone is here when the roster did not fully load', () => {
    let state = startHeadcount('jc1', MORNING);
    for (const id of ['a', 'b', 'c']) state = togglePresent(state, id);
    expect(headcountAnswer(summarize(state, roster), { complete: false })).toBe('3 of 3 here');
  });

  it('keys local days by the device calendar', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });
});
