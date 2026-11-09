/**
 * The destination's name, set larger than the display style where it is the subject of the view.
 * The loading placeholders size their bars from the same values, so nothing moves when the name
 * arrives.
 */
export const DESTINATION_TYPE = {
  /** The lead trip card on Journeys. */
  leadCard: { fontSize: 44, lineHeight: 48 },
  /** The trip screen's photo header. */
  hero: { fontSize: 46, lineHeight: 50 },
  /** The invite's destination card. */
  invite: { fontSize: 42, lineHeight: 46 },
} as const;
