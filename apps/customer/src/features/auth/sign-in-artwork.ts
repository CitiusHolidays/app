import type { MessageKey } from '@/i18n/locales/en';

/**
 * Three of the website's sign-in artworks (`public/images/auth`), cropped to the portrait header
 * at 1290 px wide and bundled, so the screen is whole without a connection.
 */
export interface Artwork {
  place: MessageKey;
  source: number;
}
export const HALLSTATT: Artwork = { place: 'signIn.place.hallstatt', source: require('../../../assets/images/sign-in/hallstatt.webp') };
export const SIGN_IN_ARTWORK: readonly Artwork[] = [
  HALLSTATT,
  { place: 'signIn.place.udaipur', source: require('../../../assets/images/sign-in/udaipur.webp') },
  { place: 'signIn.place.munnar', source: require('../../../assets/images/sign-in/munnar.webp') },
];

/** How far the sign-in sheet rises over the photograph. */
export const SHEET_OVERLAP = 28;
