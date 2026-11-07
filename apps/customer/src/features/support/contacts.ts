/**
 * Citius Holidays' public contact details, as on the website's contact page
 * (`src/data/publicContacts.ts`) and footer. Public information only.
 */
export const CITIUS_EMAIL = 'info@citiusholidays.com';

export const CITIUS_OFFICES = [
  { city: 'Mumbai', dialPhone: '+919920993259', displayPhone: '+91 99209 93259' },
  { city: 'Bengaluru', dialPhone: '+919900814292', displayPhone: '+91 99008 14292' },
  { city: 'Kolkata', dialPhone: '+919831082929', displayPhone: '+91 98310 82929' },
] as const;

const SITE = 'https://www.citiusholidays.com';
export const PRIVACY_URL = `${SITE}/policies?view=privacy`;
export const TERMS_URL = `${SITE}/policies?view=terms`;
