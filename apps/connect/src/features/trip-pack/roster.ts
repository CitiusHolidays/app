import type { StatusKind } from '@citius/ui';

import type { RosterEntry, TripPack } from './trip-pack';

export interface RosterGroup {
  entries: RosterEntry[];
  id: string;
  label: string;
  /** Travellers in the group who are counted (cancellations and drops are listed, not counted). */
  travelling: number;
}

/** The roster by travel batch, in the pack's batch order; travellers without a batch come last. */
export function groupRoster(pack: Pick<TripPack, 'batches' | 'roster'>): RosterGroup[] {
  const groups = pack.batches.map((batch) => ({ entries: [] as RosterEntry[], id: batch.id, label: batch.label }));
  const byId = new Map(groups.map((group) => [group.id, group]));
  const loose: RosterEntry[] = [];
  for (const entry of pack.roster) {
    const group = byId.get(entry.batchId);
    if (group) group.entries.push(entry);
    else loose.push(entry);
  }
  if (loose.length > 0) groups.push({ entries: loose, id: 'no-batch', label: 'No batch' });
  return groups
    .filter((group) => group.entries.length > 0)
    .map((group) => ({ ...group, travelling: group.entries.filter((entry) => entry.travelling).length }));
}

/** Calling status as a pill: done is good, no response needs a call back, the rest is pending. */
export function callingPill(status: string): { kind: StatusKind; label: string } {
  const label = status.trim();
  if (label === 'Done') return { kind: 'good', label: 'Called' };
  if (label === 'No response') return { kind: 'attention', label: 'No response' };
  return { kind: 'neutral', label: label && label !== 'Pending' ? label : 'To call' };
}

/** Guest type and the document statuses, in that order: "VIP · Visa approved". */
export function rosterMeta(entry: RosterEntry) {
  const parts = [entry.guestType];
  if (entry.visaStatus) parts.push(`Visa ${entry.visaStatus.toLowerCase()}`);
  if (entry.passportStatus) parts.push(`Passport ${entry.passportStatus.toLowerCase()}`);
  if (!entry.travelling) parts.push('Not travelling');
  return parts.filter(Boolean).join(' · ');
}
