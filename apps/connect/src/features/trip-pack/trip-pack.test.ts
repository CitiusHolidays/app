import { buildTripPack, freshnessLabel, isPackExpired, packExpiresAt, TRIP_PACK_TTL_DAYS } from './trip-pack';
import { batches, commandCenter, tourManagers, travellers } from './fixtures';

const SAVED_AT = new Date(2026, 10, 6, 7, 12).getTime();

function build() {
  return buildTripPack({ batches, commandCenter, savedAt: SAVED_AT, tourManagers, travellers });
}

describe('buildTripPack', () => {
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

  it('labels batches by reference, sorted', () => {
    expect(build().batches).toEqual([
      { id: 'tb_1', label: 'Bus 1' },
      { id: 'tb_2', label: 'Bus 2' },
    ]);
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
  const format = { locale: 'en-GB', timeZone: undefined };
  it('shows the time alone when saved today', () => {
    expect(freshnessLabel(SAVED_AT, new Date(2026, 10, 6, 15, 0).getTime(), format)).toBe('Saved, updated 07:12');
  });
  it('adds the date when saved on an earlier day', () => {
    expect(freshnessLabel(SAVED_AT, new Date(2026, 10, 7, 9, 0).getTime(), format)).toBe('Saved, updated 6 Nov, 07:12');
  });
});
