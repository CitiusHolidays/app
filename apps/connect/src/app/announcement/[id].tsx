import { Button, PressableScale, StatusPill, space, Surface, Text, useAppTheme } from '@citius/ui';
import { useLocalSearchParams } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { Avatar, Icon, ListCard, PageTitle, QuietState, Screen, SectionTitle, TickStrip } from '@/components/kit';
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
      <Screen tabBar={false}>
        <Surface>
          <QuietState text="This announcement is not on this phone." />
        </Surface>
      </Screen>
    );
  }
  const acks = ackSummary(announcement);
  const names = new Map((pack?.roster ?? []).map((entry) => [entry.id, entry.name]));
  const acknowledged = new Set(announcement.acknowledgedIds);
  const sharedAt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' }).format(
    announcement.sharedAt
  );
  const answer = `${acks.acknowledged} of ${acks.total} have seen it`;
  return (
    <Screen tabBar={false}>
      <PageTitle
        kicker={`Shared ${sharedAt}`}
        meta={`${acks.total} ${acks.total === 1 ? 'traveller' : 'travellers'}`}
        title={`To ${announcement.audienceLabel}`}
      />
      <Surface style={{ gap: space.lg }}>
        <Text selectable>{announcement.body}</Text>
        <Button
          icon={<Icon ios="square.and.arrow.up" md="share" size={15} />}
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
      </Surface>
      <Surface style={{ gap: space.md }} variant="hero">
        <View accessibilityLabel={answer} accessibilityLiveRegion="polite" accessible style={{ gap: space.md }}>
          <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 6 }}>
            <Text tabular variant="answer">
              {acks.acknowledged}
            </Text>
            <Text style={{ fontFamily: theme.font.medium }} tabular tone="muted" variant="section">
              / {acks.total} have seen it
            </Text>
          </View>
          <TickStrip marked={acks.acknowledged} total={acks.total} />
        </View>
      </Surface>
      <View style={{ gap: space.md }}>
        <SectionTitle>Who has seen it</SectionTitle>
        <Text tone="muted" variant="secondary">
          Tick each traveller once they confirm, in person, by reply or by phone.
        </Text>
        {announcement.recipientIds.length > 0 ? (
          <ListCard>
            {announcement.recipientIds.map((travellerId, index) => {
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
                  <View
                    style={[
                      styles.row,
                      {
                        borderBottomColor: theme.color.rule,
                        borderBottomWidth: index === announcement.recipientIds.length - 1 ? 0 : StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <Avatar checked={seen} name={name} />
                    <Text numberOfLines={2} style={{ flex: 1 }} variant="rowTitle">
                      {name}
                    </Text>
                    <StatusPill kind={seen ? 'good' : 'neutral'} label={seen ? 'Seen' : 'Not yet'} />
                  </View>
                </PressableScale>
              );
            })}
          </ListCard>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: space.md, minHeight: 64, paddingVertical: space.md },
});
