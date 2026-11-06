import { readPublicConfig } from '@citius/core';

// Written out literally so Expo inlines the values at build time.
export const publicConfig = readPublicConfig({
  EXPO_PUBLIC_CONVEX_SITE_URL: process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
  EXPO_PUBLIC_CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
});
