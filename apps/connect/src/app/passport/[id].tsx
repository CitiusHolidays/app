import { staffApi } from '@citius/backend';
import { Banner, Button, space, Surface, Text, useAppTheme } from '@citius/ui';
import { useConvex } from 'convex/react';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { PageTitle, Placeholder, QuietState, Screen } from '@/components/kit';
import { useStaffSession } from '@/features/gate/session';
import { base64FromBytes, passportProblem, passportViewKind } from '@/features/passports/passport-window';
import { useTrips } from '@/features/trips/trips-context';
import { logEvent } from '@/lib/safe-log';

type ScanState =
  | { kind: 'loading' }
  | { kind: 'image'; uri: string }
  | { kind: 'pdf' | 'other' }
  | { kind: 'hidden' }
  | { kind: 'problem'; problem: string };

/**
 * One traveller's passport scan, for the tour manager's own group during the trip. Every open is
 * a server read (and an audit row). The decrypted bytes live only in this screen's memory, as a
 * `data:` URI with image caching off: never in the store, the outbox, a file or the image cache,
 * and they are dropped when the screen closes or the app leaves the foreground.
 *
 * Screenshots are not blocked: expo-screen-capture is not in this build.
 */
export default function PassportViewer() {
  // A passport on screen must not end up in screenshots, screen recordings or the app switcher.
  usePreventScreenCapture('passport');
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const convex = useConvex();
  const { gate, online } = useStaffSession();
  const canReachServer = online && gate.kind === 'staff' && !gate.offline;
  const { pack } = useTrips();
  const name = pack?.roster.find((entry) => entry.id === id)?.name ?? 'Traveller';
  const [view, setView] = useState<ScanState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const fetched = useRef<number | null>(null);

  useEffect(() => {
    // One read per open: losing and regaining the connection does not read it again.
    if (!(canReachServer && id) || fetched.current === attempt) {
      return;
    }
    fetched.current = attempt;
    let active = true;
    convex
      .action(staffApi.getFieldPassportFile.ref, { travellerId: id })
      .then((file) => {
        if (!active) return;
        const kind = passportViewKind(file.mimeType);
        setView(kind === 'image' ? { kind, uri: `data:${file.mimeType};base64,${base64FromBytes(file.bytes)}` } : { kind });
      })
      .catch((error: unknown) => {
        logEvent('passport.open-failed', error);
        if (active) setView({ kind: 'problem', problem: passportProblem(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt, canReachServer, convex, id]);

  useEffect(() => {
    // Leaving the app (or the app switcher, which snapshots the screen) drops the scan.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setView({ kind: 'hidden' });
    });
    return () => subscription.remove();
  }, []);

  const again = () => {
    setView({ kind: 'loading' });
    setAttempt((value) => value + 1);
  };

  let body;
  if (!canReachServer && view.kind !== 'image') {
    body = (
      <Banner tone="attention">
        <Text variant="bodyStrong">You are offline</Text>
        <Text variant="secondary">Passports open only online, and are never saved on this phone.</Text>
      </Banner>
    );
  } else if (view.kind === 'loading') {
    body = (
      <Surface>
        <Placeholder lines={6} />
      </Surface>
    );
  } else if (view.kind === 'image') {
    body = (
      <Surface style={{ padding: space.sm }}>
        <Image
          accessibilityLabel={`Passport scan of ${name}`}
          accessible
          cachePolicy="none"
          contentFit="contain"
          source={{ uri: view.uri }}
          style={{ aspectRatio: 0.75, backgroundColor: theme.color.inset, borderRadius: theme.radius.inset, width: '100%' }}
        />
      </Surface>
    );
  } else if (view.kind === 'hidden') {
    body = (
      <Surface style={{ gap: space.md }}>
        <QuietState text="The passport was hidden when you left the app." />
        <Button label="Show again" onPress={again} variant="secondary" />
      </Surface>
    );
  } else if (view.kind === 'problem') {
    body = (
      <Banner tone="danger">
        <Text accessibilityLiveRegion="polite" variant="secondary">
          {view.problem}
        </Text>
        <View style={{ marginTop: space.sm }}>
          <Button label="Try again" onPress={again} variant="secondary" />
        </View>
      </Banner>
    );
  } else {
    body = (
      <Banner tone="attention">
        <Text variant="secondary">
          {view.kind === 'pdf'
            ? 'This passport scan is a PDF, which this version of the app cannot show. Ask Operations for it.'
            : 'This passport scan is in a file type the app cannot show. Ask Operations for it.'}
        </Text>
      </Banner>
    );
  }

  return (
    <Screen tabBar={false}>
      <PageTitle kicker="Passport" meta="Shown while this screen is open; never saved on this phone." title={name} />
      {body}
    </Screen>
  );
}
