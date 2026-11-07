import type { DestinationPhoto } from '@citius/backend/customer';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentRef, createContext, useContext, useRef, useState } from 'react';
import { PixelRatio, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { coverUri, originalCoverUri, PREVIEW_WIDTH, photoWidth } from '@/features/trips/cover';

const planes = require('@/assets/images/splash-icon.png');

/** Night with a low orange glow: the cover for a destination Citius has no sharp photo of yet. */
function Poster() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['#1a2a6c', '#0b1026']} end={{ x: 0.2, y: 1 }} start={{ x: 0.9, y: 0 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(245,130,32,0)', 'rgba(245,130,32,0.28)']}
        end={{ x: 0.5, y: 1 }}
        start={{ x: 0.5, y: 0.35 }}
        style={StyleSheet.absoluteFill}
      />
      <Image contentFit="contain" source={planes} style={{ height: 210, opacity: 0.85, position: 'absolute', right: -40, top: 6, width: 300 }} />
    </View>
  );
}

/**
 * Lazy loading for a scrolling list of covers. The list shares how far it has scrolled and the
 * screen height; a cover starts its full photo once it is within two screens of the bottom edge.
 * Outside a list (the trip header) every cover loads at once.
 */
export interface ScrollWindow {
  scrollY: number;
  viewport: number;
}

export const ScrollWindowContext = createContext<ScrollWindow>({ scrollY: 0, viewport: Number.POSITIVE_INFINITY });

function useNearScreen(contentY: number | null) {
  const { scrollY, viewport } = useContext(ScrollWindowContext);
  const near = contentY !== null && contentY <= scrollY + viewport * 2;
  // Once near, a cover stays loaded (React's "adjust state while rendering" pattern).
  const [seen, setSeen] = useState(near);
  if (near && !seen) setSeen(true);
  return seen || near;
}

/**
 * The destination as the centrepiece, loaded the way a slow connection needs without giving up
 * quality: the photo's BlurHash at once (no network), then a ~3 KB preview, then the photo at the
 * cover's real pixel width and the website's full quality, each fading over the last. Everything
 * is kept on the phone, so the next time it opens sharp. Covers far down a list wait until they
 * are near the screen. The foot is darkened so white type reads on any picture.
 */
export function DestinationCover({
  photo,
  priority = 'normal',
  scrim = 'bottom',
  style,
}: {
  photo: DestinationPhoto | null;
  priority?: 'low' | 'normal' | 'high';
  /** bottom: text sits low. full: text sits over the whole photo (the trip header). */
  scrim?: 'bottom' | 'full';
  style?: StyleProp<ViewStyle>;
}) {
  const scroll = useContext(ScrollWindowContext);
  const frame = useRef<ComponentRef<typeof View>>(null);
  const [layout, setLayout] = useState<{ width: number; y: number } | null>(null);
  const [fallback, setFallback] = useState<'optimized' | 'original' | 'none'>('optimized');
  const near = useNearScreen(layout?.y ?? null);
  const width = layout ? photoWidth(Math.ceil(layout.width * PixelRatio.get())) : null;
  let source: string | null = null;
  if (photo && width && near) {
    source = fallback === 'optimized' ? coverUri(photo.path, width) : fallback === 'original' ? originalCoverUri(photo.path) : null;
  }
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      collapsable={false}
      onLayout={(event) => {
        const { width: w } = event.nativeEvent.layout;
        const scrolledAtLayout = scroll.scrollY;
        // Where the cover sits in the list's content, for lazy loading.
        frame.current?.measureInWindow((_x, windowY) => setLayout({ width: w, y: windowY + scrolledAtLayout }));
      }}
      pointerEvents="none"
      ref={frame}
      style={[StyleSheet.absoluteFill, { backgroundColor: '#0b1026' }, style]}
    >
      {photo ? (
        <Image
          cachePolicy="disk"
          contentFit="cover"
          placeholder={{ blurhash: photo.placeholder }}
          placeholderContentFit="cover"
          priority={priority}
          recyclingKey={`${photo.path}:preview`}
          source={{ uri: coverUri(photo.path, PREVIEW_WIDTH) }}
          style={StyleSheet.absoluteFill}
          transition={150}
        />
      ) : (
        <Poster />
      )}
      {source ? (
        <Image
          cachePolicy="disk"
          contentFit="cover"
          onError={() => setFallback((current) => (current === 'optimized' ? 'original' : 'none'))}
          priority={priority}
          recyclingKey={source}
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          transition={350}
        />
      ) : null}
      <LinearGradient
        colors={
          scrim === 'full'
            ? ['rgba(11,16,38,0.55)', 'rgba(11,16,38,0.05)', 'rgba(11,16,38,0.92)']
            : ['rgba(11,16,38,0.25)', 'rgba(11,16,38,0)', 'rgba(11,16,38,0.94)']
        }
        locations={[0, 0.38, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** Starts the full photo for a cover the traveller is about to open (the trip header). */
export function prefetchCover(photo: DestinationPhoto | null, screenWidth: number) {
  if (!photo) return;
  void Image.prefetch(coverUri(photo.path, photoWidth(Math.ceil(screenWidth * PixelRatio.get()))), 'disk').catch(() => undefined);
}
