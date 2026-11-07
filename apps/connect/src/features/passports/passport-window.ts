import type { FieldPassportRow } from '@citius/backend';

/** The office's zone; the server draws the trip window in it (see listFieldPassports). */
export const OFFICE_TIME_ZONE = 'Asia/Kolkata';

type PassportWindow = Pick<FieldPassportRow, 'closesAt' | 'opensAt'>;

/** One "4 Nov" formatter per time zone, built on first use: an Intl formatter is slow to construct. */
const dayFormats = new Map<string, Intl.DateTimeFormat>();
function dayFormat(timeZone: string) {
  let format = dayFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone });
    dayFormats.set(timeZone, format);
  }
  return format;
}

/**
 * The window in a few words: "Opens on 4 Nov", "Available during the trip, until 11 Nov",
 * "Closed after 11 Nov". The server's window opens at 00:00 on the day before travel and closes
 * at 24:00 on the day after, so the last day shown is the one that ends at `closesAt`.
 */
export function passportWindowLabel(window: PassportWindow, now: number, timeZone = OFFICE_TIME_ZONE) {
  if (window.opensAt === null || window.closesAt === null) {
    return 'Opens once the trip dates are set';
  }
  const day = (at: number) => dayFormat(timeZone).format(at);
  if (now < window.opensAt) {
    return `Opens on ${day(window.opensAt)}`;
  }
  if (now >= window.closesAt) {
    return `Closed after ${day(window.closesAt - 1)}`;
  }
  return `Available during the trip, until ${day(window.closesAt - 1)}`;
}

/** "Passports · Opens on 4 Nov (India time)", for a roster group. */
export function passportWindowLine(window: PassportWindow, now: number, timeZone = OFFICE_TIME_ZONE) {
  const zone = timeZone === OFFICE_TIME_ZONE ? 'India time' : timeZone;
  return `Passports · ${passportWindowLabel(window, now, timeZone)} (${zone})`;
}

export type PassportViewKind = 'image' | 'pdf' | 'other';

/**
 * What the viewer can do with a file: JPEG, PNG, HEIC and WebP show as an image (with the `jpg`
 * and `heif` spellings some uploads carry), PDFs in the PDF view, and nothing else.
 */
export function passportViewKind(mimeType: string): PassportViewKind {
  const type = mimeType.trim().toLowerCase();
  if (/^image\/(jpeg|jpg|png|webp|heic|heif)$/.test(type)) return 'image';
  if (type === 'application/pdf') return 'pdf';
  return 'other';
}

/**
 * Whether the roster offers Passport for a scan of this type (null: no scan). Every open is an
 * audited server read, so a file the app cannot show is never fetched.
 */
export function canOpenPassportInApp(mimeType: string | null) {
  return mimeType !== null && passportViewKind(mimeType) !== 'other';
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 of the bytes, for a `data:` URI held in memory. Nothing is written anywhere. */
export function base64FromBytes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    const chunk = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += ALPHABET[(chunk >> 18) & 63];
    out += ALPHABET[(chunk >> 12) & 63];
    out += b === undefined ? '=' : ALPHABET[(chunk >> 6) & 63];
    out += c === undefined ? '=' : ALPHABET[chunk & 63];
  }
  return out;
}

/** Server refusals in words a tour manager can act on. Server text is never shown raw. */
export function passportProblem(error: unknown) {
  if (!(typeof error === 'object' && error !== null && 'data' in error)) {
    return 'Could not load the passport. Check the connection and try again.';
  }
  const data = (error as { data: unknown }).data;
  if (typeof data === 'object' && data !== null && (data as { code?: unknown }).code === 'PORTAL_FILE_RATE_LIMITED') {
    return 'Too many files were opened in a short time. Wait a minute, then try again.';
  }
  const text = typeof data === 'string' ? data : '';
  if (/day before the trip starts/i.test(text)) {
    return 'Passports open in the app from the day before the trip starts until the day after it ends.';
  }
  if (/not found/i.test(text)) {
    return 'No passport scan is on file for this traveller. Ask Operations.';
  }
  return 'This traveller is not in your group, or your access has changed. Refresh the trip and try again.';
}
