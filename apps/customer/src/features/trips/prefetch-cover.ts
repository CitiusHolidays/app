import type { DestinationPhoto } from '@citius/backend/customer';
import { Image } from 'expo-image';
import { PixelRatio } from 'react-native';

import { coverUri, photoWidth } from './cover';

/** Starts the full photo for a cover the traveller is about to open (the trip header). */
export function prefetchCover(photo: DestinationPhoto | null, screenWidth: number) {
  if (!photo) return;
  void Image.prefetch(coverUri(photo.path, photoWidth(Math.ceil(screenWidth * PixelRatio.get()))), 'disk').catch(() => undefined);
}
