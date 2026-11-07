import { coverUri, originalCoverUri, photoWidth, tripNights } from './cover';

jest.mock('@/lib/env', () => ({ WEBSITE_URL: 'https://www.citiusholidays.com' }));

describe('destination covers', () => {
  it('asks the website optimizer for the photo at full quality', () => {
    expect(coverUri('/images/event-photo-booth/bali.webp', 1200)).toBe(
      'https://www.citiusholidays.com/_next/image?url=%2Fimages%2Fevent-photo-booth%2Fbali.webp&w=1200&q=85'
    );
    expect(originalCoverUri('/images/x.webp')).toBe('https://www.citiusholidays.com/images/x.webp');
  });

  it('never asks for fewer pixels than the screen shows', () => {
    expect(photoWidth(362 * 3)).toBe(1200);
    expect(photoWidth(402 * 3)).toBe(1920);
    expect(photoWidth(360 * 2)).toBe(750);
    expect(photoWidth(5000)).toBe(1920);
  });

  it('counts nights between calendar days', () => {
    expect(tripNights('2026-09-10', '2026-09-21')).toBe(11);
    expect(tripNights('2026-09-10', '2026-09-10')).toBeNull();
    expect(tripNights(null, '2026-09-21')).toBeNull();
  });
});
