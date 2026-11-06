import { Button, space, Surface, Text } from '@citius/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';

import { Chip, ChipRow, haptic, Row, Screen, SectionTitle, TextField } from '@/components/kit';
import {
  ackSummary,
  type Audience,
  audienceLabel,
  composeShareText,
  createAnnouncement,
  recipientsFor,
} from '@/features/announcements/announcements';
import { useAnnouncements } from '@/features/announcements/use-announcements';
import { useStaff } from '@/features/gate/session';
import { useTrips } from '@/features/trips/trips-context';
import { localId } from '@/lib/ids';
import { logEvent } from '@/lib/safe-log';

/** Write once, send through today's channels with the share sheet, keep a local log. */
export default function Announce() {
  const staff = useStaff();
  const { pack, selected } = useTrips();
  const { add, log } = useAnnouncements(selected?.id ?? null);
  const [audience, setAudience] = useState<Audience>({ kind: 'trip' });
  const [body, setBody] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  if (!pack || !selected) {
    return (
      <Screen>
        <Text tone="muted">Save the trip pack first (Trip tab), then write an announcement.</Text>
      </Screen>
    );
  }
  const label = audienceLabel(pack, audience);
  const recipients = recipientsFor(pack, audience);
  const message = composeShareText({
    audienceLabel: label,
    body,
    sender: staff.name,
    tripLabel: `${selected.jobCode} ${selected.destination}`.trim(),
  });

  const share = async () => {
    if (!body.trim()) {
      setProblem('Write the message first.');
      return;
    }
    setProblem(null);
    try {
      const result = await Share.share({ message });
      if (result.action === Share.dismissedAction) {
        return;
      }
      const announcement = createAnnouncement({ audience, body, id: localId('ann'), now: Date.now(), pack });
      add(announcement);
      haptic('success');
      setBody('');
      router.replace({ params: { id: announcement.id }, pathname: '/announcement/[id]' });
    } catch (error) {
      logEvent('announce.share-failed', error);
      setProblem('The share sheet could not open. Copy the message and send it from your messaging app.');
    }
  };

  return (
    <Screen>
      <ChipRow label="Send to">
        <Chip label="Whole trip" onPress={() => setAudience({ kind: 'trip' })} selected={audience.kind === 'trip'} />
        {pack.batches.map((batch) => (
          <Chip
            key={batch.id}
            label={batch.label}
            onPress={() => setAudience({ batchId: batch.id, kind: 'batch' })}
            selected={audience.kind === 'batch' && audience.batchId === batch.id}
          />
        ))}
      </ChipRow>
      <Text variant="secondary" tabular tone="muted">
        To {label} · {recipients.length} travellers
      </Text>
      <TextField
        label="Message"
        multiline
        onChangeText={setBody}
        placeholder="For example: The bus leaves the hotel at 8:15. Meet in the lobby."
        style={{ minHeight: 120, textAlignVertical: 'top' }}
        value={body}
      />
      {body.trim() ? (
        <Surface>
          <Text variant="meta" tone="muted">
            Preview
          </Text>
          <Text selectable>{message}</Text>
        </Surface>
      ) : null}
      {problem ? (
        <Text accessibilityLiveRegion="polite" tone="warning">
          {problem}
        </Text>
      ) : null}
      <Button label="Share message" onPress={() => void share()} />
      <Text variant="secondary" tone="muted">
        Opens your phone&apos;s share sheet, so you can send it on WhatsApp, SMS or email as today. Citius Connect keeps a
        copy here with a checklist of who has seen it.
      </Text>
      {log.length > 0 ? (
        <View style={{ gap: space.xs }}>
          <SectionTitle>Earlier announcements</SectionTitle>
          {log.map((item) => {
            const acks = ackSummary(item);
            return (
              <Row
                key={item.id}
                onPress={() => router.push({ params: { id: item.id }, pathname: '/announcement/[id]' })}
                subtitle={`To ${item.audienceLabel} · ${acks.acknowledged} of ${acks.total} have seen it`}
                title={item.body}
              />
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}
