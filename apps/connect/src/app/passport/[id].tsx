import { Banner, Button, space, Surface, Text, useAppTheme } from '@citius/ui';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionPill, PageTitle, QuietState, Screen } from '@/components/kit';
import { useCanReachServer } from '@/features/gate/reach';
import { PassportPdf } from '@/features/passports/passport-pdf';
import { PassportSkeleton } from '@/features/passports/passport-skeleton';
import { type ScanState, usePassportScan } from '@/features/passports/use-passport-scan';
import { useTrips } from '@/features/trips/trips-context';

type ImageScan = Extract<ScanState, { kind: 'image' }>;

/** The scan as an image: the preview fades to full quality, or stays with a way to try again. */
function ScanImage({
  imageAspect,
  name,
  onAspect,
  onRetry,
  view,
}: {
  imageAspect: number;
  name: string;
  onAspect: (aspect: number) => void;
  onRetry: () => void;
  view: ImageScan;
}) {
  const theme = useAppTheme();
  return (
    <Surface style={{ padding: space.sm }}>
      <Image
        accessibilityLabel={`Passport scan of ${name}`}
        accessible
        cachePolicy="none"
        contentFit="contain"
        onLoad={({ source }) => {
          if (source.width > 0 && source.height > 0) onAspect(source.width / source.height);
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
      {/* One status line in both states, so the card keeps its height when the full scan arrives
          first (no preview) and matches the skeleton's line. */}
      {view.quality === 'previewOnly' ? (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Text accessibilityLiveRegion="polite" tone="muted" variant="secondary">
            Showing a lower-quality copy. The full scan could not be loaded.
          </Text>
          <Button label="Try full quality" onPress={onRetry} variant="secondary" />
        </View>
      ) : (
        <Text accessibilityLiveRegion="polite" style={{ marginTop: space.sm }} tone="muted" variant="secondary">
          {view.quality === 'preview' ? 'Loading full quality…' : 'Shown in full quality.'}
        </Text>
      )}
    </Surface>
  );
}

/** Everything the viewer can show in place of a PDF: the scan, its loading state or why it is not there. */
function ScanBody({
  offline,
  view,
  ...image
}: {
  imageAspect: number;
  name: string;
  offline: boolean;
  onAspect: (aspect: number) => void;
  onRetry: () => void;
  view: ScanState;
}) {
  const { onRetry } = image;
  if (offline && view.kind !== 'image' && view.kind !== 'pdf') {
    return (
      <Banner tone="attention">
        <Text variant="bodyStrong">You are offline</Text>
        <Text variant="secondary">Passports open only online, and are never saved on this phone.</Text>
      </Banner>
    );
  }
  switch (view.kind) {
    case 'loading':
      return <PassportSkeleton />;
    case 'image':
      return <ScanImage {...image} view={view} />;
    case 'pdf':
      return null;
    case 'hidden':
      return (
        <Surface style={{ gap: space.md }}>
          <QuietState text="The passport was hidden when you left the app." />
          <Button label="Show again" onPress={onRetry} variant="secondary" />
        </Surface>
      );
    case 'problem':
      return (
        <Banner tone="danger">
          <Text accessibilityLiveRegion="polite" variant="secondary">
            {view.problem}
          </Text>
          <View style={{ marginTop: space.sm }}>
            <Button label="Try again" onPress={onRetry} variant="secondary" />
          </View>
        </Banner>
      );
    default:
      return (
        <Banner tone="attention">
          <Text variant="secondary">
            {view.kind === 'pdfUnsupported'
              ? 'This passport scan is a PDF, which this version of the app cannot show. Update the app, or ask Operations for it.'
              : 'This passport scan is in a file type the app cannot show. Ask Operations for it.'}
          </Text>
        </Banner>
      );
  }
}

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
  const canReachServer = useCanReachServer();
  const { pack } = useTrips();
  const name = pack?.roster.find((entry) => entry.id === id)?.name ?? 'Traveller';
  const { again, pdfFailed, view } = usePassportScan(id, canReachServer);
  // The scan's own shape once it has loaded, so a landscape data page is not boxed as portrait.
  const [imageAspect, setImageAspect] = useState(1.42);

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
            onError={() => pdfFailed('This passport PDF could not be opened. Ask Operations for it.')}
            uri={view.uri}
          />
        </View>
      ) : (
        <Screen tabBar={false}>
          <ScanBody imageAspect={imageAspect} name={name} offline={!canReachServer} onAspect={setImageAspect} onRetry={again} view={view} />
        </Screen>
      )}
    </View>
  );
}
