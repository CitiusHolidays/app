import { parseCalendarDay } from '@/lib/calendar-day';
import { WEBSITE_URL } from '@/lib/env';

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

/** Nights between two calendar days, or null. */
export function tripNights(start: string | null, end: string | null) {
  const day = (value: string | null) => {
    const parsed = parseCalendarDay(value);
    return parsed ? Date.UTC(parsed.year, parsed.month, parsed.day) : null;
  };
  const from = day(start);
  const to = day(end);
  if (from === null || to === null || to <= from) return null;
  return Math.round((to - from) / 86_400_000);
}
