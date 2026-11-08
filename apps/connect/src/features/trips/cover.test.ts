import { cardPhotoWidth, coverUri, originalCoverUri, PREVIEW_WIDTH, photoWidth } from './cover';

describe('destination cover URLs', () => {
  it('picks the first optimizer width at or above the real pixel width, never upscaling', () => {
    expect(photoWidth(400)).toBe(640);
    expect(photoWidth(1100)).toBe(1200);
    expect(photoWidth(5000)).toBe(1920);
  });

  it('sizes the card photo from the phone width, the same for the card and the offline prefetch', () => {
    expect(cardPhotoWidth(402, 3)).toBe(1920);
    expect(cardPhotoWidth(360, 2)).toBe(750);
  });

  it('asks the website optimizer for the photo at quality 85', () => {
    expect(coverUri('/images/destinations/bali.webp', PREVIEW_WIDTH)).toBe(
      'https://www.citiusholidays.com/_next/image?url=%2Fimages%2Fdestinations%2Fbali.webp&w=96&q=85'
    );
    expect(originalCoverUri('/images/destinations/bali.webp')).toBe('https://www.citiusholidays.com/images/destinations/bali.webp');
  });
});
