import { buildTripPack, contactKey, freshnessLabel, isPackExpired, packExpiresAt, TRIP_PACK_TTL_DAYS } from './trip-pack';
import { batches, commandCenter, tourManagers, travellers } from './fixtures';

const SAVED_AT = new Date(2026, 10, 6, 7, 12).getTime();

function build(complete = true) {
  return buildTripPack({ batches, commandCenter, complete, savedAt: SAVED_AT, tourManagers, travellers });
}

describe('buildTripPack', () => {
  it('keeps the destination photo so the trip card opens on it offline, and null when there is none', () => {
    const bali = { path: '/images/event-photo-booth/bali.webp', placeholder: 'UjHoE?t6V@oKL4NHn~fP?dRlaxj@x^ayaya#' };
    expect(buildTripPack({ batches, commandCenter: { ...commandCenter, destinationCover: bali }, complete: true, savedAt: SAVED_AT, tourManagers, travellers }).cover).toEqual(bali);
    expect(build().cover).toBeNull();
  });

  it('keeps only roster fields: name, batch, guest type, calling status, phone and status words', () => {
    const pack = build();
    const asha = pack.roster.find((entry) => entry.id === 't_2');
    expect(asha).toEqual({
      batchId: 'tb_1',
      batchLabel: 'Bus 1',
      callingStatus: 'Done',
      guestType: 'VIP',
      id: 't_2',
      name: 'Asha Example',
      passportStatus: 'Received',
      phone: '+919000000000',
      travelling: true,
      visaStatus: 'Approved',
    });
  });

  it('never stores passport files, expiry dates, email or finance data', () => {
    const serialized = JSON.stringify(build());
    for (const forbidden of ['hasPassportScan', 'passportExpiryDate', '2030-01-01', 'someone@example.test', 'balanceAmount', 'invoices']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('orders the roster by batch, then name, and marks cancellations as not travelling', () => {
    const pack = build();
    expect(pack.roster.map((entry) => entry.name)).toEqual(['Asha Example', 'Zed Example', 'Bina Example', 'Chand Example']);
    expect(pack.roster.find((entry) => entry.id === 't_4')?.travelling).toBe(false);
  });

  it('keeps the frozen itinerary text as the schedule', () => {
    expect(build().schedule).toEqual({ itineraryText: 'Day 1: Arrive Denpasar.\nDay 2: Ubud tour.', proposalCode: 'PR-TEST-1' });
  });

  it('lists active tour managers with phones, then the office owners', () => {
    expect(build().contacts).toEqual([
      { name: 'Test Tour Manager', note: 'Lobby at 07:30', phone: '+919000000009', role: 'Tour manager · Bus 1' },
      { name: 'Ops Person', role: 'Operations' },
      { name: 'Ticketing Person', role: 'Ticketing' },
    ]);
  });

  it('records whether every roster and contact page was loaded', () => {
    expect(build().complete).toBe(true);
    expect(build(false).complete).toBe(false);
  });

  it('labels batches by reference, sorted', () => {
    expect(build().batches).toEqual([
      { id: 'tb_1', label: 'Bus 1' },
      { id: 'tb_2', label: 'Bus 2' },
    ]);
  });

  it("keeps only the batches with travellers in the tour manager's group, which the server narrows the roster to", () => {
    const extra = [...batches, { ...batches[0]!, batchReference: 'Bus 3', id: 'tb_3' }];
    const onlyBus1 = travellers.filter((row) => row.travelBatchId === 'tb_1');
    const pack = buildTripPack({ batches: extra, commandCenter, complete: true, savedAt: SAVED_AT, tourManagers, travellers: onlyBus1 });
    expect(pack.batches).toEqual([{ id: 'tb_1', label: 'Bus 1' }]);
    expect(pack.roster.map((entry) => entry.id).sort()).toEqual(['t_1', 't_2']);
    // A contact for another batch still names it.
    const other = buildTripPack({
      batches: extra,
      commandCenter,
      complete: true,
      savedAt: SAVED_AT,
      tourManagers: [{ ...tourManagers[0]!, name: 'Other Manager', travelBatchId: 'tb_3' }],
      travellers: onlyBus1,
    });
    expect(other.contacts[0]?.role).toBe('Tour manager · Bus 3');
  });
});

describe('buildTripPack labels and contacts', () => {
  it('drops the Job Card code from batch names that repeat it', () => {
    const named = batches.map((batch) => ({ ...batch, batchReference: `${commandCenter.jobCard.jobCode} / ${batch.batchCode}` }));
    const pack = buildTripPack({ batches: named, commandCenter, complete: true, savedAt: SAVED_AT, tourManagers, travellers });
    expect(pack.batches.map((batch) => batch.label)).toEqual(['B1', 'B2']);
    expect(pack.roster.find((entry) => entry.id === 't_2')?.batchLabel).toBe('B1');
  });

  it('lists a tour manager assigned to several batches once', () => {
    const twice = [
      ...tourManagers,
      { ...tourManagers[0]!, id: 'tm_3', reportingInstructions: 'Lobby at 07:30', travelBatchId: 'tb_2' },
    ];
    const pack = buildTripPack({ batches, commandCenter, complete: true, savedAt: SAVED_AT, tourManagers: twice, travellers });
    expect(pack.contacts.filter((contact) => contact.name === 'Test Tour Manager')).toEqual([
      { name: 'Test Tour Manager', note: 'Lobby at 07:30', phone: '+919000000009', role: 'Tour manager · Bus 1, Bus 2' },
    ]);
  });

  it('gives every contact its own stable key, even one person holding two office roles', () => {
    const sameOwner = { ...commandCenter, jobCard: { ...commandCenter.jobCard, ticketingOwnerName: commandCenter.jobCard.operationsOwnerName } };
    const namesake = { ...tourManagers[0]!, id: 'tm_4', phone: '+91 90000 00010', travelBatchId: 'tb_2' };
    const pack = buildTripPack({ batches, commandCenter: sameOwner, complete: true, savedAt: SAVED_AT, tourManagers: [...tourManagers, namesake], travellers });
    const keys = pack.contacts.map(contactKey);
    expect(new Set(keys).size).toBe(pack.contacts.length);
    expect(pack.contacts.map(contactKey)).toEqual(keys);
    expect(contactKey(pack.contacts[0]!)).toBe(contactKey({ ...pack.contacts[0]! }));
  });
});

describe('trip pack TTL', () => {
  it(`expires ${TRIP_PACK_TTL_DAYS} days after the end of the trip's last day`, () => {
    const expiresAt = packExpiresAt({ savedAt: SAVED_AT, travelEndDate: '2026-11-10' });
    expect(new Date(expiresAt)).toEqual(new Date(2026, 10, 18, 0, 0, 0, 0));
    expect(isPackExpired({ expiresAt }, new Date(2026, 10, 17, 23, 59).getTime())).toBe(false);
    expect(isPackExpired({ expiresAt }, new Date(2026, 10, 18, 0, 0).getTime())).toBe(true);
  });

  it('falls back to 7 days after saving when the end date is missing or malformed', () => {
    expect(packExpiresAt({ savedAt: SAVED_AT, travelEndDate: '' })).toBe(SAVED_AT + 7 * 86_400_000);
    expect(packExpiresAt({ savedAt: SAVED_AT, travelEndDate: '10/11/2026' })).toBe(SAVED_AT + 7 * 86_400_000);
  });
});

describe('freshnessLabel', () => {
  // The test runner's own locale is en-US, like a US phone: the label must not follow it.
  const format = { timeZone: undefined };
  it('shows the time alone when saved today', () => {
    expect(freshnessLabel(SAVED_AT, new Date(2026, 10, 6, 15, 0).getTime(), format)).toBe('Saved, updated 07:12');
  });
  it('adds the date when saved on an earlier day', () => {
    expect(freshnessLabel(SAVED_AT, new Date(2026, 10, 7, 9, 0).getTime(), format)).toBe('Saved, updated 6 Nov, 07:12');
  });
});
