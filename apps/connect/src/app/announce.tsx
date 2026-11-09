import { Button, space, Surface, Text, useAppTheme } from '@citius/ui';
import { router, usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { Chip, ChipRow, Icon, ListCard, ProblemBanner, QuietState, Row, Screen, SectionTitle, TextField } from '@/components/kit';
import {
  ackSummary,
  announcementHref,
  type Audience,
  audienceLabel,
  composeShareText,
  createAnnouncement,
  recipientsFor,
  tripLabel,
} from '@/features/announcements/announcements';
import { wasSent } from '@/features/announcements/confirm-sent';
import { useAnnouncements } from '@/features/announcements/use-announcements';
import { useStaff } from '@/features/gate/session';
import { useTrips } from '@/features/trips/trips-context';
import { localId } from '@/lib/ids';
import { logEvent } from '@/lib/safe-log';
import { haptic } from '@/lib/haptics';

/** The office records announcements of up to this many characters. */
const MAX_ANNOUNCEMENT_LENGTH = 4000;

/** Write once, send through today's channels with the share sheet, keep a log the office also sees. */
export default function Announce() {
  const theme = useAppTheme();
  const staff = useStaff();
  const { pack, selected } = useTrips();
  const { add, log } = useAnnouncements(selected?.id ?? null);
  const [audience, setAudience] = useState<Audience>({ kind: 'trip' });
  const [body, setBody] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  // A message not yet shared is lost on close, so closing asks first (swipe down or back).
  const allowLeave = usePreventRemove(Boolean(body.trim()) && !leaving, ({ repeat }) => {
    Alert.alert('Discard this message?', 'It has not been shared, and it is not kept.', [
      { style: 'cancel', text: 'Keep editing' },
      {
        onPress: () => {
          setLeaving(true);
          repeat();
        },
        style: 'destructive',
        text: 'Discard',
      },
    ]);
  });

  if (!pack || !selected) {
    return (
      <Screen tabBar={false}>
        <Surface>
          <QuietState text="Save the trip pack first (Trip tab), then write an announcement." />
        </Surface>
      </Screen>
    );
  }
  const label = audienceLabel(pack, audience);
  const recipients = recipientsFor(pack, audience);
  const message = composeShareText({
    audienceLabel: label,
    body,
    sender: staff.name,
    tripLabel: tripLabel(selected),
  });

  const share = async () => {
    if (!body.trim()) {
      setProblem('Write the message first.');
      return;
    }
    setProblem(null);
    try {
      // Logged, and sent to the office, only once the message went out.
      if (!(await wasSent(await Share.share({ message })))) {
        return;
      }
      const announcement = createAnnouncement({ audience, body, id: localId('ann'), now: Date.now(), pack });
      add(announcement);
      haptic('success');
      setBody('');
      // Shared and logged, so leaving loses nothing: open the checklist without the discard question.
      allowLeave();
      router.replace(announcementHref(announcement));
    } catch (error) {
      logEvent('announce.share-failed', error);
      setProblem('The share sheet could not open. Copy the message and send it from your messaging app.');
    }
  };

  return (
    <Screen tabBar={false}>
      <View style={{ gap: space.sm }}>
        <ChipRow label="Send to" showLabel>
          <Chip label="Your group" onPress={() => setAudience({ kind: 'trip' })} selected={audience.kind === 'trip'} />
          {pack.batches.map((batch) => (
            <Chip
              key={batch.id}
              label={batch.label}
              onPress={() => setAudience({ batchId: batch.id, kind: 'batch' })}
              selected={audience.kind === 'batch' && audience.batchId === batch.id}
            />
          ))}
        </ChipRow>
        <Text tabular tone="muted" variant="secondary">
          To {label} · {recipients.length} {recipients.length === 1 ? 'traveller' : 'travellers'}
        </Text>
      </View>
      <TextField
        label="Message"
        maxLength={MAX_ANNOUNCEMENT_LENGTH}
        multiline
        onChangeText={setBody}
        placeholder="For example: The bus leaves the hotel at 8:15. Meet in the lobby."
        style={{ minHeight: 132, paddingTop: space.md, textAlignVertical: 'top' }}
        value={body}
      />
      {body.trim() ? (
        <Surface style={{ gap: space.xs + 2 }} variant="inset">
          <Text tone="muted" variant="label">
            Preview
          </Text>
          <Text selectable>{message}</Text>
        </Surface>
      ) : null}
      {problem ? (
        <ProblemBanner text={problem} />
      ) : null}
      <View style={{ gap: space.md }}>
        <Button
          icon={<Icon color={theme.color.onPrimary} ios="square.and.arrow.up" md="share" size={16} />}
          label="Share message"
          onPress={() => void share()}
        />
        <Text style={{ textAlign: 'center' }} tone="muted" variant="secondary">
          Opens your phone&apos;s share sheet, so you can send it on WhatsApp, SMS or email as today. Citius Connect keeps a
          copy here with a checklist of who has seen it, and sends both to the office.
        </Text>
      </View>
      {log.length > 0 ? (
        <View style={{ gap: space.md }}>
          <SectionTitle>Earlier announcements</SectionTitle>
          <ListCard>
            {log.map((item, index) => {
              const acks = ackSummary(item);
              return (
                <Row
                  accessibilityLabel={`${item.body}. To ${item.audienceLabel}, ${acks.acknowledged} of ${acks.total} have seen it`}
                  chevron
                  key={item.id}
                  last={index === log.length - 1}
                  onPress={() => router.push(announcementHref(item))}
                  subtitle={`To ${item.audienceLabel} · ${acks.acknowledged} of ${acks.total} have seen it`}
                  title={item.body}
                />
              );
            })}
          </ListCard>
        </View>
      ) : null}
    </Screen>
  );
}
