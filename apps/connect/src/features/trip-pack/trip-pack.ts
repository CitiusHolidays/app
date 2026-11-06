import type { CommandCenter, TourManagerRow, TravelBatchRow, TravellerRow } from '@citius/backend';

/** Version 2 added `complete`; older packs are ignored and fetched again. */
export const TRIP_PACK_VERSION = 2;
export const TRIP_PACK_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RosterEntry {
  batchId: string;
  batchLabel: string;
  callingStatus: string;
  guestType: string;
  id: string;
  name: string;
  /** Status words only (for example "Received"); never a file, number or date. */
  passportStatus: string;
  /** Dialable form (digits and a leading +), empty when Citius holds no number. */
  phone: string;
  /** False for cancellations and last-minute drops: they are listed but not counted. */
  travelling: boolean;
  visaStatus: string;
}

export interface TripContact {
  name: string;
  note?: string;
  phone?: string;
  role: string;
}

export interface TripPack {
  batches: { id: string; label: string }[];
  clientName: string;
  /** False when a batch, traveller or contact list hit the page budget: the roster may be short. */
  complete: boolean;
  contacts: TripContact[];
  destination: string;
  expiresAt: number;
  jobCardId: string;
  jobCode: string;
  roster: RosterEntry[];
  savedAt: number;
  schedule: { itineraryText: string; proposalCode: string };
  status: string;
  travelEndDate: string;
  travelStartDate: string;
  version: typeof TRIP_PACK_VERSION;
}

export interface TripPackSource {
  batches: TravelBatchRow[];
  commandCenter: CommandCenter;
  /** Every list was read to the end. */
  complete: boolean;
  savedAt: number;
  tourManagers: TourManagerRow[];
  travellers: TravellerRow[];
}

export function dialable(phone: string | undefined | null) {
  const trimmed = (phone ?? '').trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) {
    return '';
  }
  return trimmed.replace(/[()\s]/g, '').startsWith('+') ? `+${digits}` : digits;
}

function batchLabel(batch: Pick<TravelBatchRow, 'batchCode' | 'batchReference'>) {
  return batch.batchReference.trim() || batch.batchCode.trim() || 'Batch';
}

const byText = (left: string, right: string) => left.localeCompare(right, undefined, { sensitivity: 'base' });

/** Local midnight at the start of a YYYY-MM-DD date, or null when the text is not that shape. */
function localDayStart(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) {
    return null;
  }
  const value = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(value.getTime()) ? null : value;
}

/** The pack expires 7 days after the trip's last day ends; without an end date, 7 days after saving. */
export function packExpiresAt({ savedAt, travelEndDate }: { savedAt: number; travelEndDate: string }) {
  const end = localDayStart(travelEndDate);
  if (!end) {
    return savedAt + TRIP_PACK_TTL_DAYS * DAY_MS;
  }
  const expiry = new Date(end);
  expiry.setDate(expiry.getDate() + 1 + TRIP_PACK_TTL_DAYS);
  return expiry.getTime();
}

export function isPackExpired(pack: Pick<TripPack, 'expiresAt'>, now: number) {
  return now >= pack.expiresAt;
}

/**
 * Builds the offline trip pack from server rows. Every stored field is named here; anything
 * else in the responses (passport scan flags and expiry, email, consent, finance) is dropped.
 */
export function buildTripPack(source: TripPackSource): TripPack {
  const { jobCard, proposal } = source.commandCenter;
  const batches = source.batches
    .map((batch) => ({ id: batch.id, label: batchLabel(batch) }))
    .sort((left, right) => byText(left.label, right.label));
  const labelById = new Map(batches.map((batch) => [batch.id, batch.label]));
  const batchOrder = new Map(batches.map((batch, index) => [batch.id, index]));

  const roster: RosterEntry[] = source.travellers
    .map((row) => ({
      batchId: row.travelBatchId ?? '',
      batchLabel: labelById.get(row.travelBatchId) ?? (row.travelBatchCode || ''),
      callingStatus: row.callingStatus ?? '',
      guestType: row.guestType ?? '',
      id: row.id,
      name: row.fullName.trim(),
      passportStatus: row.passportStatus ?? '',
      phone: dialable(row.contactNo),
      travelling: !(row.cancellation || row.lastMinuteDrop),
      visaStatus: row.visaStatus ?? '',
    }))
    .sort((left, right) => {
      const batchDelta =
        (batchOrder.get(left.batchId) ?? Number.MAX_SAFE_INTEGER) -
        (batchOrder.get(right.batchId) ?? Number.MAX_SAFE_INTEGER);
      return batchDelta || byText(left.name, right.name);
    });

  const tourManagerContacts: TripContact[] = source.tourManagers
    .filter((row) => row.status === 'Assigned')
    .map((row) => {
      const batch = row.travelBatchId ? labelById.get(row.travelBatchId) : undefined;
      const contact: TripContact = { name: row.name, role: batch ? `Tour manager · ${batch}` : 'Tour manager' };
      const phone = dialable(row.phone);
      if (row.reportingInstructions.trim()) {
        contact.note = row.reportingInstructions.trim();
      }
      if (phone) {
        contact.phone = phone;
      }
      return contact;
    });
  const officeContacts: TripContact[] = [
    { name: jobCard.operationsOwnerName, role: 'Operations' },
    { name: jobCard.ticketingOwnerName, role: 'Ticketing' },
  ].filter((contact) => contact.name.trim());

  return {
    batches,
    clientName: jobCard.clientName,
    complete: source.complete,
    contacts: [...tourManagerContacts, ...officeContacts],
    destination: jobCard.destination,
    expiresAt: packExpiresAt({ savedAt: source.savedAt, travelEndDate: jobCard.travelEndDate }),
    jobCardId: jobCard.id,
    jobCode: jobCard.jobCode,
    roster,
    savedAt: source.savedAt,
    schedule: {
      itineraryText: proposal?.itinerarySummary ?? '',
      proposalCode: proposal?.proposalCode ?? '',
    },
    status: jobCard.status,
    travelEndDate: jobCard.travelEndDate,
    travelStartDate: jobCard.travelStartDate,
    version: TRIP_PACK_VERSION,
  };
}

export interface FreshnessFormat {
  locale?: string;
  timeZone?: string;
}

function sameLocalDay(left: number, right: number) {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Saved, updated 07:12", with the date added when the save was on an earlier day. */
export function freshnessLabel(savedAt: number, now: number, format: FreshnessFormat = {}) {
  const time = new Intl.DateTimeFormat(format.locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: format.timeZone,
  }).format(savedAt);
  if (sameLocalDay(savedAt, now)) {
    return `Saved, updated ${time}`;
  }
  const day = new Intl.DateTimeFormat(format.locale, {
    day: 'numeric',
    month: 'short',
    timeZone: format.timeZone,
  }).format(savedAt);
  return `Saved, updated ${day}, ${time}`;
}
