import type { DestinationPhoto } from '@citius/backend';
import { Image } from 'expo-image';
import { PixelRatio } from 'react-native';

import { cardPhotoWidth, coverUri, PREVIEW_WIDTH } from './cover';

/**
 * Saves the trip card's photo to disk alongside the trip pack, so Today opens on the real photo
 * offline, not only its BlurHash. Both use `cardPhotoWidth`, so this
 * is exactly the file the card asks for. A failed fetch is ignored: the card loads it later.
 */
export function prefetchCover(photo: DestinationPhoto | null | undefined, windowWidth: number) {
  if (!photo) return;
  for (const width of [PREVIEW_WIDTH, cardPhotoWidth(windowWidth, PixelRatio.get())]) {
    void Image.prefetch(coverUri(photo.path, width), 'disk').catch(() => undefined);
  }
}
