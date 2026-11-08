import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { PixelRatio, type StyleProp, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { cardPhotoWidth, coverUri, type DestinationPhoto, originalCoverUri, PREVIEW_WIDTH } from '@/features/trips/cover';

const mark = require('@/assets/images/splash-icon.png');

/** Connect navy with the link mark low on the right: the cover when Citius has no photo of the place. */
function Poster() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['#1b2547', '#0c1124']} end={{ x: 0.2, y: 1 }} start={{ x: 0.9, y: 0 }} style={StyleSheet.absoluteFill} />
      <Image contentFit="contain" source={mark} style={{ height: 220, opacity: 0.22, position: 'absolute', right: -36, top: -12, width: 220 }} />
    </View>
  );
}

/**
 * The trip's destination as the centrepiece. It loads the way a slow connection needs without
 * giving up quality: the BlurHash at once (no network), then a ~3 KB preview, then the photo at
 * the card's real pixel width, each fading over the last. Every layer is cached on disk, so the
 * card opens sharp offline once it has been seen. The foot is darkened so white type reads on
 * any picture. Under reduced motion the layers swap without fading.
 */
export function DestinationCover({ photo, style }: { photo: DestinationPhoto | null; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const window = useWindowDimensions();
  const [fallback, setFallback] = useState<'optimized' | 'original' | 'none'>('optimized');
  // The same width the offline prefetch saved, so a trip opened without signal finds it on disk.
  const width = cardPhotoWidth(window.width, PixelRatio.get());
  let source: string | null = null;
  if (photo) {
    source = fallback === 'optimized' ? coverUri(photo.path, width) : fallback === 'original' ? originalCoverUri(photo.path) : null;
  }
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: '#0c1124' }, style]}
    >
      {photo ? (
        <Image
          cachePolicy="disk"
          contentFit="cover"
          placeholder={{ blurhash: photo.placeholder }}
          placeholderContentFit="cover"
          recyclingKey={`${photo.path}:preview`}
          source={{ uri: coverUri(photo.path, PREVIEW_WIDTH) }}
          style={StyleSheet.absoluteFill}
          transition={reduced ? 0 : 150}
        />
      ) : (
        <Poster />
      )}
      {source ? (
        <Image
          cachePolicy="disk"
          contentFit="cover"
          onError={() => setFallback((current) => (current === 'optimized' ? 'original' : 'none'))}
          recyclingKey={source}
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          transition={reduced ? 0 : 350}
        />
      ) : null}
      <LinearGradient
        colors={['rgba(12,17,36,0.5)', 'rgba(12,17,36,0)', 'rgba(12,17,36,0.62)', 'rgba(12,17,36,0.94)']}
        locations={[0, 0.26, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
