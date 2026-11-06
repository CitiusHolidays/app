import { Button, PressableScale, space, Surface, Text, useAppTheme } from '@citius/ui';
import { useLocalSearchParams } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { Screen, SectionTitle } from '@/components/kit';
import { ackSummary, composeShareText } from '@/features/announcements/announcements';
import { useAnnouncements } from '@/features/announcements/use-announcements';
import { useStaff } from '@/features/gate/session';
import { useTrips } from '@/features/trips/trips-context';
import { logEvent } from '@/lib/safe-log';

/** The acknowledgement checklist the tour manager keeps for one announcement. */
export default function AnnouncementDetail() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const staff = useStaff();
  const { pack, selected } = useTrips();
  const { log, toggleAck } = useAnnouncements(selected?.id ?? null);
  const announcement = log.find((item) => item.id === id);
  if (!announcement) {
    return (
      <Screen>
        <Text tone="muted">This announcement is not on this phone.</Text>
      </Screen>
    );
  }
  const acks = ackSummary(announcement);
  const names = new Map((pack?.roster ?? []).map((entry) => [entry.id, entry.name]));
  const acknowledged = new Set(announcement.acknowledgedIds);
  const sharedAt = new Intl.DateTimeFormat(undefined, { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' }).format(
    announcement.sharedAt
  );
  return (
    <Screen>
      <Surface style={{ gap: space.xs }}>
        <Text variant="meta" tone="muted">
          To {announcement.audienceLabel} · shared {sharedAt}
        </Text>
        <Text selectable>{announcement.body}</Text>
      </Surface>
      <View accessible accessibilityLiveRegion="polite">
        <Text variant="answer" tabular>
          {acks.acknowledged} of {acks.total} have seen it
        </Text>
      </View>
      <Button
        label="Share again"
        onPress={() =>
          void Share.share({
            message: composeShareText({
              audienceLabel: announcement.audienceLabel,
              body: announcement.body,
              sender: staff.name,
              tripLabel: `${selected?.jobCode ?? ''} ${selected?.destination ?? ''}`.trim(),
            }),
          }).catch((error: unknown) => logEvent('announce.reshare-failed', error))
        }
        variant="secondary"
      />
      <SectionTitle>Who has seen it</SectionTitle>
      <Text variant="secondary" tone="muted">
        Tick each traveller once they confirm, in person, by reply or by phone.
      </Text>
      <View>
        {announcement.recipientIds.map((travellerId) => {
          const seen = acknowledged.has(travellerId);
          const name = names.get(travellerId) ?? 'Traveller no longer on the roster';
          return (
            <PressableScale
              accessibilityLabel={name}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: seen }}
              key={travellerId}
              onPress={() => toggleAck(announcement.id, travellerId)}
            >
              <View style={[styles.row, { borderBottomColor: theme.color.border, minHeight: theme.minTarget }]}>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {name}
                </Text>
                <Text variant="meta" tone={seen ? 'success' : 'warning'}>
                  {seen ? '✓ Seen' : 'Not yet'}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
});
