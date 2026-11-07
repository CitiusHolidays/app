import { staffApi } from '@citius/backend';
import { Banner, Button, space, Surface, Text, useAppTheme } from '@citius/ui';
import { useConvex } from 'convex/react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionPill, PageTitle, QuietState, Screen } from '@/components/kit';
import { useStaffSession } from '@/features/gate/session';
import { canShowPdf, PassportPdf } from '@/features/passports/passport-pdf';
import { PassportSkeleton } from '@/features/passports/passport-skeleton';
import { deleteAllPassportPdfs, deletePassportPdf, writePassportPdf } from '@/features/passports/passport-pdf-file';
import { base64FromBytes, passportProblem, passportViewKind } from '@/features/passports/passport-window';
import { useTrips } from '@/features/trips/trips-context';
import { logEvent } from '@/lib/safe-log';

type ScanState =
  | { kind: 'loading' }
  | { kind: 'image'; uri: string }
  | { kind: 'pdf'; uri: string }
  | { kind: 'other' | 'pdfUnsupported' }
  | { kind: 'hidden' }
  | { kind: 'problem'; problem: string };

/**
 * One traveller's passport scan, full screen, for the tour manager's own group during the trip.
 * Every open is a server read (and an audit row).
 *
 * Images are held only in this screen's memory, as a `data:` URI with image caching off. A PDF
 * needs a file for the native view: one randomly named file in the private cache, deleted when
 * the screen closes or the app leaves the foreground (see passport-pdf-file). Neither ever goes
 * to the store, the outbox or a cache that outlives the screen.
 */
export default function PassportViewer() {
  // A passport on screen must not end up in screenshots, screen recordings or the app switcher.
  usePreventScreenCapture('passport');
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const convex = useConvex();
  const { gate, online } = useStaffSession();
  const canReachServer = online && gate.kind === 'staff' && !gate.offline;
  const { pack } = useTrips();
  const name = pack?.roster.find((entry) => entry.id === id)?.name ?? 'Traveller';
  const [view, setView] = useState<ScanState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // The scan's own shape once it has loaded, so a landscape data page is not boxed as portrait.
  const [imageAspect, setImageAspect] = useState(1.42);
  const fetched = useRef<number | null>(null);
  // False while the app is in the background: a read that lands then is not shown or written.
  const foreground = useRef(true);

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
        if (!foreground.current) {
          setView({ kind: 'hidden' });
          return;
        }
        const kind = passportViewKind(file.mimeType);
        if (kind === 'image') {
          setView({ kind, uri: `data:${file.mimeType};base64,${base64FromBytes(file.bytes)}` });
        } else if (kind === 'pdf') {
          setView(canShowPdf() ? { kind, uri: writePassportPdf(file.bytes) } : { kind: 'pdfUnsupported' });
        } else {
          setView({ kind });
        }
      })
      .catch((error: unknown) => {
        logEvent('passport.open-failed', error);
        if (active) setView({ kind: 'problem', problem: passportProblem(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt, canReachServer, convex, id]);

  // The PDF's file lives exactly as long as it is on screen: any change of view, or closing the
  // screen, deletes it.
  const pdfUri = view.kind === 'pdf' ? view.uri : null;
  useEffect(() => {
    if (!pdfUri) return;
    return () => deletePassportPdf(pdfUri);
  }, [pdfUri]);

  useEffect(() => {
    // Leaving the app (or the app switcher, which snapshots the screen) drops the scan. The file
    // goes at once, without waiting for a render the OS may not allow in the background.
    const subscription = AppState.addEventListener('change', (state) => {
      foreground.current = state === 'active';
      if (state !== 'active') {
        deleteAllPassportPdfs();
        setView({ kind: 'hidden' });
      }
    });
    return () => subscription.remove();
  }, []);

  const again = () => {
    foreground.current = true;
    setView({ kind: 'loading' });
    setAttempt((value) => value + 1);
  };

  let body;
  if (!canReachServer && view.kind !== 'image' && view.kind !== 'pdf') {
    body = (
      <Banner tone="attention">
        <Text variant="bodyStrong">You are offline</Text>
        <Text variant="secondary">Passports open only online, and are never saved on this phone.</Text>
      </Banner>
    );
  } else if (view.kind === 'loading') {
    body = <PassportSkeleton />;
  } else if (view.kind === 'image') {
    body = (
      <Surface style={{ padding: space.sm }}>
        <Image
          accessibilityLabel={`Passport scan of ${name}`}
          accessible
          cachePolicy="none"
          contentFit="contain"
          onLoad={({ source }) => {
            if (source.width > 0 && source.height > 0) setImageAspect(source.width / source.height);
          }}
          source={{ uri: view.uri }}
          style={{ aspectRatio: imageAspect, backgroundColor: theme.color.inset, borderRadius: theme.radius.inset, width: '100%' }}
          transition={180}
        />
      </Surface>
    );
  } else if (view.kind === 'pdf') {
    body = null;
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
          {view.kind === 'pdfUnsupported'
            ? 'This passport scan is a PDF, which this version of the app cannot show. Update the app, or ask Operations for it.'
            : 'This passport scan is in a file type the app cannot show. Ask Operations for it.'}
        </Text>
      </Banner>
    );
  }

  return (
    <View style={{ backgroundColor: theme.color.ground, flex: 1 }}>
      <View
        style={{
          alignItems: 'flex-start',
          flexDirection: 'row',
          gap: space.md,
          paddingBottom: space.md,
          paddingHorizontal: theme.frame,
          paddingTop: insets.top + space.lg,
        }}
      >
        <View style={{ flex: 1 }}>
          <PageTitle kicker="Passport" meta="Shown while this screen is open; never saved on this phone." title={name} />
        </View>
        <ActionPill accessibilityLabel="Close passport" icon={{ ios: 'xmark', md: 'close' }} label="Close" onPress={() => router.back()} />
      </View>
      {view.kind === 'pdf' ? (
        <View style={{ flex: 1, paddingBottom: insets.bottom + space.md, paddingHorizontal: theme.frame }}>
          <PassportPdf
            name={name}
            onError={() => setView({ kind: 'problem', problem: 'This passport PDF could not be opened. Ask Operations for it.' })}
            uri={view.uri}
          />
        </View>
      ) : (
        <Screen tabBar={false}>{body}</Screen>
      )}
    </View>
  );
}
