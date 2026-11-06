import { expoClient } from "@better-auth/expo/client";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ConvexReactClient } from "convex/react";

/** Storage the Better Auth Expo plugin needs; on native this is expo-secure-store. */
export interface SecureKeyValueStore {
  getItem: (key: string) => string | null;
  getItemAsync: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => void;
  setItemAsync: (key: string, value: string) => Promise<void>;
}

export interface AuthClientOptions {
  /** The Convex site URL (`*.convex.site`), where Better Auth's HTTP routes live. */
  baseURL: string;
  /** "web" builds skip the Expo plugin; the server has no cross-domain plugin, so web is preview only. */
  platform: "ios" | "android" | "web" | string;
  /** The app's URL scheme, also used as the SecureStore key prefix. */
  scheme: string;
  storage: SecureKeyValueStore;
}

/**
 * One Better Auth client per app, following the Convex Better Auth Expo guide: the Expo plugin
 * keeps the session in SecureStore, and the Convex plugin exchanges it for a Convex token from
 * the same issuer the website uses.
 */
export function createAppAuthClient(options: AuthClientOptions) {
  if (options.platform === "web") {
    return createAuthClient({ baseURL: options.baseURL, plugins: [convexClient()] });
  }
  return createAuthClient({
    baseURL: options.baseURL,
    plugins: [
      expoClient({
        scheme: options.scheme,
        storage: options.storage,
        storagePrefix: options.scheme,
      }),
      convexClient(),
    ],
  });
}

export type AppAuthClient = ReturnType<typeof createAppAuthClient>;

export function createAppConvexClient(convexUrl: string) {
  return new ConvexReactClient(convexUrl, {
    // Queries wait for the auth token instead of running unauthenticated first.
    expectAuth: true,
    unsavedChangesWarning: false,
  });
}
