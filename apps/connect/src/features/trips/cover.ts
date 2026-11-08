import { WEBSITE_URL } from '@/lib/website';

/** A destination photo from the website: its path and the BlurHash shown before any byte loads. */
export interface DestinationPhoto {
  path: string;
  placeholder: string;
}

/**
 * Widths the website's image optimizer serves (Next.js image and device sizes). The preview is
 * the smallest that still blurs well; the photo is the first width at or above the cover's real
 * pixel width, so it is never upscaled on the phone.
 */
export const PREVIEW_WIDTH = 96;
const PHOTO_WIDTHS = [640, 750, 828, 1080, 1200, 1920] as const;

export function photoWidth(pixels: number) {
  return PHOTO_WIDTHS.find((width) => width >= pixels) ?? 1920;
}

/** A destination photo through the website optimizer, at the site's own quality (85). */
export function coverUri(path: string, width: number) {
  return `${WEBSITE_URL}/_next/image?url=${encodeURIComponent(path)}&w=${width}&q=85`;
}

export function originalCoverUri(path: string) {
  return `${WEBSITE_URL}${path}`;
}

/**
 * The width the trip card asks for: the phone's full width in pixels, rounded up to an optimizer
 * width. The card and the offline prefetch share it, so the photo saved with the trip pack is
 * exactly the one the card shows.
 */
export function cardPhotoWidth(windowWidth: number, pixelRatio: number) {
  return photoWidth(Math.ceil(windowWidth * pixelRatio));
}
