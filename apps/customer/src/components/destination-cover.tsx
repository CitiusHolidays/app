import type { DestinationPhoto } from '@citius/backend/customer';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { PixelRatio, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

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
 * The destination as the centrepiece, loaded the way a slow connection needs without giving up
 * quality: the photo's BlurHash at once (no network), then a ~3 KB preview, then the photo at the
 * cover's real pixel width and the website's full quality, each fading over the last. Everything
 * is kept on the phone, so the next time it opens sharp. Lists are virtualised, so a cover far
 * down a list is not mounted and loads nothing until it nears the screen. The foot is darkened so
 * white type reads on any picture. Under reduced motion the layers swap without fading.
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
  const reduced = useReducedMotion();
  const [layoutWidth, setLayoutWidth] = useState<number | null>(null);
  const [fallback, setFallback] = useState<'optimized' | 'original' | 'none'>('optimized');
  const width = layoutWidth ? photoWidth(Math.ceil(layoutWidth * PixelRatio.get())) : null;
  let source: string | null = null;
  if (photo && width) {
    source = fallback === 'optimized' ? coverUri(photo.path, width) : fallback === 'original' ? originalCoverUri(photo.path) : null;
  }
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
      pointerEvents="none"
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
          priority={priority}
          recyclingKey={source}
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          transition={reduced ? 0 : 350}
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
