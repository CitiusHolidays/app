import { batches, commandCenter, tourManagers, travellers } from './fixtures';
import { callingPill, groupRoster, rosterMeta } from './roster';
import { buildTripPack } from './trip-pack';

const pack = buildTripPack({ batches, commandCenter, complete: true, savedAt: 0, tourManagers, travellers });

describe('roster groups', () => {
  it('groups travellers by batch in batch order and counts only those travelling', () => {
    const groups = groupRoster(pack);
    expect(groups.map((group) => [group.label, group.entries.map((entry) => entry.name), group.travelling])).toEqual([
      ['Bus 1', ['Asha Example', 'Zed Example'], 2],
      ['Bus 2', ['Bina Example', 'Chand Example'], 1],
    ]);
  });

  it('puts travellers without a known batch last, and drops empty batches', () => {
    const roster = [{ ...pack.roster[0]!, batchId: '', id: 'x' }];
    expect(groupRoster({ batches: pack.batches, roster })).toEqual([
      { entries: roster, id: 'no-batch', label: 'No batch', travelling: 1 },
    ]);
  });

  it('shows calling status as a shape-coded pill', () => {
    expect(callingPill('Done')).toEqual({ kind: 'good', label: 'Called' });
    expect(callingPill('No response')).toEqual({ kind: 'attention', label: 'No response' });
    expect(callingPill('Pending')).toEqual({ kind: 'neutral', label: 'To call' });
    expect(callingPill('')).toEqual({ kind: 'neutral', label: 'To call' });
  });

  it('describes a traveller by guest type and document status', () => {
    const asha = pack.roster.find((entry) => entry.name === 'Asha Example')!;
    expect(rosterMeta(asha)).toBe('VIP · Visa approved · Passport received');
    const chand = pack.roster.find((entry) => entry.name === 'Chand Example')!;
    expect(rosterMeta(chand)).toMatch(/Not travelling$/);
  });
});
