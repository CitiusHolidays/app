import { createAppConvexClient, createCustomerAuthClient } from '@citius/core';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { publicConfig } from './env';

/**
 * Must equal `scheme` in app.json. The backend trusts exactly `citius://` for this app, so sign-in
 * works from a development or release build, not from Expo Go.
 */
export const APP_SCHEME = 'citius';

function build() {
  if (!publicConfig.ok) {
    return null;
  }
  return {
    auth: createCustomerAuthClient({
      baseURL: publicConfig.siteUrl,
      platform: Platform.OS,
      scheme: APP_SCHEME,
      storage: SecureStore,
    }),
    convex: createAppConvexClient(publicConfig.convexUrl),
  };
}

/** Null when the Convex URLs are missing; the app then shows a configuration screen. */
export const clients = build();
export type Clients = NonNullable<typeof clients>;
