import { ConvexError } from 'convex/values';

import {
  base64FromBytes,
  canOpenPassportInApp,
  passportProblem,
  passportViewKind,
  passportWindowLabel,
  passportWindowLine,
} from './passport-window';

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_MS = 5.5 * 60 * 60 * 1000;
// The server's window for a 5 to 10 Nov trip: 00:00 IST on 4 Nov to 24:00 IST on 11 Nov.
const window = {
  closesAt: Date.UTC(2026, 10, 10) + 2 * DAY_MS - IST_MS,
  opensAt: Date.UTC(2026, 10, 5) - DAY_MS - IST_MS,
};

describe('passport window copy', () => {
  it('says when passports open, in India time, before the window', () => {
    expect(passportWindowLabel(window, window.opensAt - 1)).toBe('Opens on 4 Nov');
    // 23:00 IST on 3 Nov is still 3 Nov in India, though already 4 Nov's eve in UTC terms.
    expect(passportWindowLabel(window, Date.UTC(2026, 10, 3, 17, 30))).toBe('Opens on 4 Nov');
  });

  it('says they are available during the trip, with the last day', () => {
    expect(passportWindowLabel(window, window.opensAt)).toBe('Available during the trip, until 11 Nov');
    expect(passportWindowLabel(window, window.closesAt - 1)).toBe('Available during the trip, until 11 Nov');
  });

  it('says they closed after the trip', () => {
    expect(passportWindowLabel(window, window.closesAt)).toBe('Closed after 11 Nov');
  });

  it('says the window waits for trip dates when the server has none', () => {
    expect(passportWindowLabel({ closesAt: null, opensAt: null }, 0)).toBe('Opens once the trip dates are set');
  });

  it('names the time zone the window is drawn in', () => {
    expect(passportWindowLine(window, window.opensAt - 1, 'Asia/Kolkata')).toBe('Passports · Opens on 4 Nov (India time)');
    expect(passportWindowLine(window, window.opensAt - 1, 'Europe/London')).toBe('Passports · Opens on 3 Nov (Europe/London)');
  });
});

describe('passport file handling', () => {
  it('encodes the bytes for an in-memory image, without a file', () => {
    // RFC 4648 test vectors, plus bytes that are not text.
    const vectors: [string, string][] = [
      ['', ''],
      ['f', 'Zg=='],
      ['fo', 'Zm8='],
      ['foo', 'Zm9v'],
      ['foob', 'Zm9vYg=='],
      ['fooba', 'Zm9vYmE='],
      ['foobar', 'Zm9vYmFy'],
    ];
    for (const [text, encoded] of vectors) {
      expect(base64FromBytes(new TextEncoder().encode(text).buffer)).toBe(encoded);
    }
    expect(base64FromBytes(new Uint8Array([0, 255, 254, 1]).buffer)).toBe('AP/+AQ==');
  });

  it('shows JPEG, PNG, HEIC and WebP as images and PDFs as PDFs; nothing else', () => {
    for (const type of ['image/jpeg', 'IMAGE/PNG', 'image/heic', 'image/heif', 'image/webp', ' image/jpg ']) {
      expect(passportViewKind(type)).toBe('image');
    }
    expect(passportViewKind('application/pdf')).toBe('pdf');
    for (const type of ['application/zip', 'image/tiff', 'image/gif', 'image/svg+xml', 'text/html', '']) {
      expect(passportViewKind(type)).toBe('other');
    }
  });

  it('offers the Passport button only for a scan the app can show', () => {
    expect(canOpenPassportInApp('image/jpeg')).toBe(true);
    expect(canOpenPassportInApp('image/heic')).toBe(true);
    expect(canOpenPassportInApp('application/pdf')).toBe(true);
    expect(canOpenPassportInApp('image/tiff')).toBe(false);
    expect(canOpenPassportInApp('application/msword')).toBe(false);
    // No scan on file.
    expect(canOpenPassportInApp(null)).toBe(false);
  });

  it('explains refusals in plain words', () => {
    expect(passportProblem(new ConvexError('Passports open in the app from the day before the trip starts until the day after it ends'))).toMatch(
      /day before the trip starts/
    );
    expect(passportProblem(new ConvexError({ code: 'PORTAL_FILE_RATE_LIMITED', retryAfterSeconds: 30 }))).toMatch(/Too many/);
    expect(passportProblem(new ConvexError('Passport document not found for this traveller'))).toMatch(/No passport scan/);
    expect(passportProblem(new ConvexError('FORBIDDEN'))).toMatch(/not in your group/);
    expect(passportProblem(new TypeError('Network request failed'))).toMatch(/connection/);
  });
});
