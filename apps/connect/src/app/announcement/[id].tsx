import { Button, face, PressableScale, space, StatusPill, Surface, Text, useAppTheme } from '@citius/ui';
import { useLocalSearchParams } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { Avatar, EveryoneSeal, Icon, ListCard, PageTitle, QuietState, Screen, SectionTitle, StepNumber, TickStrip } from '@/components/kit';
import { ackSummary, composeShareText } from '@/features/announcements/announcements';
import { useAnnouncements } from '@/features/announcements/use-announcements';
import { useFieldSync } from '@/features/field-sync/field-sync-context';
import { announcementPush } from '@/features/field-sync/pushes';
import { syncKey } from '@/features/field-sync/queue';
import { SyncLine } from '@/features/field-sync/sync-line';
import { useStaff } from '@/features/gate/session';
import { useTrips } from '@/features/trips/trips-context';
import { haptic, tick } from '@/lib/haptics';
import { logEvent } from '@/lib/safe-log';

const ignoredNote = (count: number) =>
  `${count} ${count === 1 ? 'traveller is' : 'travellers are'} not in your group on the office list, so the office record leaves them out.`;

/** "6 Nov, 08:15", built once: an Intl formatter is slow to construct. */
const SHARED_AT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' });

/** The acknowledgement checklist the tour manager keeps for one announcement, shared with the office. */
export default function AnnouncementDetail() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const staff = useStaff();
  const { pack, selected } = useTrips();
  const { log, toggleAck } = useAnnouncements(selected?.id ?? null);
  const sync = useFieldSync();
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
  const sharedAt = SHARED_AT.format(announcement.sharedAt);
  const answer = `${acks.acknowledged} of ${acks.total} have seen it`;
  const officeKey = syncKey(announcementPush(announcement));
  const syncItems = sync.items.filter((item) => item.key === officeKey);
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
            <StepNumber value={String(acks.acknowledged)} />
            <Text style={face(theme, 'medium')} tabular tone="muted" variant="section">
              / {acks.total} have seen it
            </Text>
            <EveryoneSeal shown={acks.total > 0 && acks.acknowledged >= acks.total} />
          </View>
          <TickStrip marked={acks.acknowledged} total={acks.total} />
        </View>
        <SyncLine ignoredNote={ignoredNote} items={syncItems} onRetry={sync.retry} />
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
                  onPress={() => {
                    // One buzz per tick; the last one to confirm gets the success buzz with the seal.
                    if (!seen && acks.acknowledged === acks.total - 1) haptic('success');
                    else tick();
                    toggleAck(announcement.id, travellerId);
                  }}
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
