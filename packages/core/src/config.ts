export interface PublicConfigInput {
  EXPO_PUBLIC_CONVEX_SITE_URL?: string;
  EXPO_PUBLIC_CONVEX_URL?: string;
}

export type PublicConfig =
  | { convexUrl: string; ok: true; siteUrl: string }
  | { missing: string[]; ok: false };

function asHttpUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? trimmed.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

/**
 * Reads the two public Convex URLs. Expo inlines `process.env.EXPO_PUBLIC_*` only when it is
 * written out literally, so the app passes the values in rather than this module reading
 * `process.env` itself.
 */
export function readPublicConfig(input: PublicConfigInput): PublicConfig {
  const convexUrl = asHttpUrl(input.EXPO_PUBLIC_CONVEX_URL);
  const siteUrl = asHttpUrl(input.EXPO_PUBLIC_CONVEX_SITE_URL);
  const missing = [
    ...(convexUrl ? [] : ["EXPO_PUBLIC_CONVEX_URL"]),
    ...(siteUrl ? [] : ["EXPO_PUBLIC_CONVEX_SITE_URL"]),
  ];
  if (convexUrl && siteUrl) {
    return { convexUrl, ok: true, siteUrl };
  }
  return { missing, ok: false };
}
