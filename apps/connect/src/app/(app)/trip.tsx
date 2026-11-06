import { Banner, Button, StatusPill, type StatusKind, space, Surface, Text } from '@citius/ui';
import { useState } from 'react';
import { View } from 'react-native';

import { FreshnessStamp } from '@/components/freshness';
import { CallButton, Chip, ChipRow, Placeholder, Row, Screen } from '@/components/kit';
import type { RosterEntry } from '@/features/trip-pack/trip-pack';
import { useTrips } from '@/features/trips/trips-context';

type Section = 'roster' | 'schedule' | 'contacts';

function callingKind(status: string): StatusKind {
  if (status === 'Done') return 'good';
  if (status === 'No response') return 'attention';
  return 'neutral';
}

function rosterSubtitle(entry: RosterEntry) {
  const parts = [entry.batchLabel, entry.guestType];
  if (entry.visaStatus) parts.push(`Visa: ${entry.visaStatus}`);
  if (entry.passportStatus) parts.push(`Passport: ${entry.passportStatus}`);
  if (!entry.travelling) parts.push('Not travelling');
  return parts.filter(Boolean).join(' · ');
}

/** The offline trip pack: roster, schedule and contacts, read-only. */
export default function TripPackScreen() {
  const { pack, packLoading, packProblem, refreshPack, selected } = useTrips();
  const [section, setSection] = useState<Section>('roster');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    void refreshPack().finally(() => setRefreshing(false));
  };

  if (!selected) {
    return (
      <Screen title="Trip">
        <Text tone="muted">Choose a trip on Today first.</Text>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing} title="Trip">
      <Text variant="secondary" tabular tone="muted">
        {selected.jobCode} · {selected.clientName}
      </Text>
      <FreshnessStamp problem={packProblem} savedAt={pack?.savedAt ?? null} />
      <ChipRow label="Trip pack section">
        <Chip label="Roster" onPress={() => setSection('roster')} selected={section === 'roster'} />
        <Chip label="Schedule" onPress={() => setSection('schedule')} selected={section === 'schedule'} />
        <Chip label="Contacts" onPress={() => setSection('contacts')} selected={section === 'contacts'} />
      </ChipRow>
      {packLoading && !pack ? <Placeholder lines={6} /> : null}
      {!packLoading && !pack ? (
        <Banner tone="attention">
          <Text variant="bodyStrong">Not saved on this phone yet</Text>
          <Text variant="secondary">Connect to the internet and refresh to save the trip pack for offline use.</Text>
          <Button busy={refreshing} label="Save trip pack" onPress={refresh} />
        </Banner>
      ) : null}
      {pack && section === 'roster' ? (
        <View>
          <Text variant="secondary" tabular tone="muted">
            {pack.roster.filter((entry) => entry.travelling).length} travelling · {pack.batches.length} travel batches
          </Text>
          {pack.complete ? null : (
            <Text tone="warning" variant="secondary">
              Not every traveller or contact could be loaded. Pull down to refresh the trip pack.
            </Text>
          )}
          {pack.roster.map((entry) => (
            <Row
              accessibilityLabel={`${entry.name}, ${rosterSubtitle(entry)}, calling ${entry.callingStatus || 'not recorded'}`}
              key={entry.id}
              subtitle={rosterSubtitle(entry)}
              title={entry.name}
              trailing={
                <View style={{ alignItems: 'flex-end', gap: space.xs }}>
                  <StatusPill kind={callingKind(entry.callingStatus)} label={entry.callingStatus || 'Not called'} />
                  {entry.phone ? <CallButton name={entry.name} phone={entry.phone} /> : null}
                </View>
              }
            />
          ))}
        </View>
      ) : null}
      {pack && section === 'schedule' ? (
        <Surface>
          {pack.schedule.itineraryText.trim() ? (
            <Text selectable>{pack.schedule.itineraryText}</Text>
          ) : (
            <Text tone="muted">No itinerary text is on the Job Card&apos;s proposal yet.</Text>
          )}
          {pack.schedule.proposalCode ? (
            <Text variant="meta" tone="muted">
              From proposal {pack.schedule.proposalCode}
            </Text>
          ) : null}
        </Surface>
      ) : null}
      {pack && section === 'contacts' ? (
        <View>
          {pack.contacts.length === 0 ? <Text tone="muted">No contacts are recorded for this trip.</Text> : null}
          {pack.contacts.map((contact, index) => (
            <Row
              key={`${contact.role}-${index}`}
              subtitle={[contact.role, contact.note].filter(Boolean).join(' · ')}
              title={contact.name}
              trailing={contact.phone ? <CallButton name={contact.name} phone={contact.phone} /> : undefined}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
