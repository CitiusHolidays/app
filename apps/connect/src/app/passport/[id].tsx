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
  // `quality`: a small preview on screen while the full scan loads ('preview'), the full scan
  // ('full'), or the preview kept because the full scan failed ('previewOnly').
  | { aspect?: number; kind: 'image'; previewUri?: string; quality: 'full' | 'preview' | 'previewOnly'; uri: string }
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
    // Both reads of this open share one audit row and one rate-limit count on the server.
    const openId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    const read = (variant: 'full' | 'preview') =>
      convex.action(staffApi.getFieldPassportFile.ref, { openId, travellerId: id, variant });
    const shown = () => active && foreground.current;
    const dataUri = (mimeType: string, bytes: ArrayBuffer) => `data:${mimeType};base64,${base64FromBytes(bytes)}`;

    // On 3G a full scan takes many seconds: show a ~60 KB preview first, then fade to full quality.
    const open = async () => {
      const first = await read('preview');
      if (!active) return;
      if (!foreground.current) {
        setView({ kind: 'hidden' });
        return;
      }
      if ('variant' in first && first.variant === 'preview') {
        const previewUri = dataUri(first.mimeType, first.bytes);
        const aspect = first.width > 0 && first.height > 0 ? first.width / first.height : undefined;
        setView({ aspect, kind: 'image', quality: 'preview', uri: previewUri });
        try {
          const full = await read('full');
          if (!active) return;
          if (!foreground.current) {
            setView({ kind: 'hidden' });
            return;
          }
          if (!('bytes' in full)) throw new Error('Full scan missing');
          setView({ aspect, kind: 'image', previewUri, quality: 'full', uri: dataUri(full.mimeType, full.bytes) });
        } catch (error) {
          logEvent('passport.full-failed', error);
          if (shown()) setView({ aspect, kind: 'image', quality: 'previewOnly', uri: previewUri });
        }
        return;
      }
      // A PDF (or a file the server cannot preview) has no preview: read the file itself.
      const file = 'bytes' in first ? first : await read('full');
      if (!active) return;
      if (!foreground.current) {
        setView({ kind: 'hidden' });
        return;
      }
      if (!('bytes' in file)) throw new Error('Passport file missing');
      showFile(file);
    };

    const showFile = (file: { bytes: ArrayBuffer; mimeType: string }) => {
        const kind = passportViewKind(file.mimeType);
        if (kind === 'image') {
          setView({ kind, quality: 'full', uri: dataUri(file.mimeType, file.bytes) });
        } else if (kind === 'pdf') {
          setView(canShowPdf() ? { kind, uri: writePassportPdf(file.bytes) } : { kind: 'pdfUnsupported' });
        } else {
          setView({ kind });
        }
    };

    open().catch((error: unknown) => {
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
          placeholder={view.previewUri ? { uri: view.previewUri } : undefined}
          placeholderContentFit="contain"
          source={{ uri: view.uri }}
          style={{
            aspectRatio: view.aspect ?? imageAspect,
            backgroundColor: theme.color.inset,
            borderRadius: theme.radius.inset,
            width: '100%',
          }}
          transition={180}
        />
        {view.quality === 'preview' ? (
          <Text accessibilityLiveRegion="polite" style={{ marginTop: space.sm }} tone="muted" variant="secondary">
            Loading full quality…
          </Text>
        ) : view.quality === 'previewOnly' ? (
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Text accessibilityLiveRegion="polite" tone="muted" variant="secondary">
              Showing a lower-quality copy. The full scan could not be loaded.
            </Text>
            <Button label="Try full quality" onPress={again} variant="secondary" />
          </View>
        ) : null}
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
