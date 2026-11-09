import { Button, space, Surface } from '@citius/ui';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Icon, ListCard, Row, SectionTitle, TextField } from '@/components/kit';
import { APP_LOCALE, CLOCK_OPTIONS } from '@/lib/dates';

import type { EarlierStop } from './headcount';

/** "07:12", built once: an Intl formatter is slow to construct. Same clock as "Synced to office". */
const STARTED_AT = new Intl.DateTimeFormat(APP_LOCALE, CLOCK_OPTIONS);

/**
 * Names a fresh stop and starts counting again from nobody, after a confirm that says what
 * happens to the stop being left: it stays in today's record, listed under "Earlier today".
 */
export function NextStop({ current, onStart }: { current: { answer: string; label: string }; onStart: (name: string) => void }) {
  const [stopName, setStopName] = useState('');
  const start = () => {
    const name = stopName.trim();
    Alert.alert(name ? `Start ${name}?` : 'Start a new stop?', `${current.label} stays in today's record: ${current.answer}. The new stop starts with nobody marked.`, [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => {
          onStart(name);
          setStopName('');
        },
        text: 'Start stop',
      },
    ]);
  };
  return (
    <Surface style={{ gap: space.md }}>
      <TextField
        hint="Starts a fresh count. Earlier stops stay in today's record."
        label="Next stop"
        onChangeText={setStopName}
        // The keyboard's own Go key starts the stop, so the button under the keyboard is optional.
        onSubmitEditing={start}
        placeholder="For example: Temple car park"
        returnKeyType="go"
        value={stopName}
      />
      <Button
        icon={<Icon ios="arrow.right" md="arrow_forward" size={15} />}
        label="Start new stop"
        onPress={start}
        variant="secondary"
      />
    </Surface>
  );
}

/** Today's stops before the current one, newest first: the record the "Next stop" hint promises. */
export function EarlierStops({ stops }: { stops: EarlierStop[] }) {
  if (stops.length === 0) {
    return null;
  }
  return (
    <View style={{ gap: space.md }}>
      <SectionTitle>Earlier today</SectionTitle>
      <ListCard>
        {stops.map((stop, index) => (
          <Row
            key={stop.id}
            last={index === stops.length - 1}
            subtitle={`Started ${STARTED_AT.format(stop.startedAt)} · ${stop.answer}`}
            title={stop.label}
          />
        ))}
      </ListCard>
    </View>
  );
}
