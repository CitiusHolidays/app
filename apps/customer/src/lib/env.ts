import { readPublicConfig } from '@citius/core';

/** The website, which serves the destination photos. Public; the same for every build. */
export const WEBSITE_URL = (process.env.EXPO_PUBLIC_WEBSITE_URL || 'https://www.citiusholidays.com').replace(/\/$/, '');

// Written out literally so Expo inlines the values at build time.
export const publicConfig = readPublicConfig({
  EXPO_PUBLIC_CONVEX_SITE_URL: process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
  EXPO_PUBLIC_CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
});
