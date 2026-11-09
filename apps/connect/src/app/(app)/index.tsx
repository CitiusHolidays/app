import { Button, space, Surface, Text, useAppTheme } from '@citius/ui';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon, ListCard, Row, Screen, SectionTitle } from '@/components/kit';
import { notificationHref } from '@/features/inbox/notification-href';
import { useInbox } from '@/features/inbox/use-inbox';
import { HeadcountCard } from '@/features/trips/today-headcount';
import { TripHero } from '@/features/trips/today-hero';
import { YourTrips } from '@/features/trips/today-trips';
import { useTrips } from '@/features/trips/trips-context';
import { TripsStatus } from '@/features/trips/trips-status';
import { useNow } from '@/lib/use-now';
import { useToast } from '@/lib/toast';

const INBOX_SHOWN = 2;

/** The start of the trip's programme, with a way into the full schedule on the Trip tab. */
function ProgrammeCard({ text, onOpen }: { onOpen: () => void; text: string }) {
  const theme = useAppTheme();
  return (
    <Surface style={{ gap: space.md }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label">Programme</Text>
        <Icon color={theme.color.muted} ios="calendar" md="calendar_today" size={17} />
      </View>
      <Text numberOfLines={3} variant="section">
        {text}
      </Text>
      <Button
        icon={<Icon ios="list.bullet" md="list" size={15} />}
        label="Open schedule"
        onPress={onOpen}
        variant="secondary"
      />
    </Surface>
  );
}

function InboxPreview() {
  const { rows } = useInbox();
  const unread = rows.filter((row) => !row.readAt);
  const shown = (unread.length > 0 ? unread : rows).slice(0, INBOX_SHOWN);
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: space.md }}>
      <SectionTitle action={{ label: 'See all', onPress: () => router.push('/inbox') }}>
        {unread.length > 0 ? `Inbox · ${unread.length} new` : 'Inbox'}
      </SectionTitle>
      <ListCard>
        {shown.map((row, index) => (
          <Row
            chevron
            key={row.id}
            last={index === shown.length - 1}
            onPress={() => router.push(notificationHref(row.id))}
            subtitle={row.body}
            title={row.title}
          />
        ))}
      </ListCard>
    </View>
  );
}

/** "Is everyone here, and what's next?" for the trip on tour, then the tour manager's trips. */
export default function Today() {
  const { canRefresh, pack, refreshPack, refreshTrips, refreshing } = useTrips();
  const toast = useToast();
  const now = useNow();
  return (
    <Screen
      header={<TripHero now={now} />}
      onRefresh={() => {
        if (!canRefresh) {
          // Nothing can be fetched; say so rather than let the pull snap back silently.
          toast('Offline. Showing what is saved on this phone.', 'saved');
          return;
        }
        void refreshTrips();
        void refreshPack();
      }}
      refreshing={refreshing}
    >
      <HeadcountCard />
      {pack?.schedule.itineraryText ? (
        <ProgrammeCard onOpen={() => router.push({ params: { view: 'schedule' }, pathname: '/trip' })} text={pack.schedule.itineraryText} />
      ) : null}
      <InboxPreview />
      <TripsStatus />
      <YourTrips now={now} />
    </Screen>
  );
}
