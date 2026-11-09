import { parseInviteToken } from '@/features/trips/model';
import { WEBSITE_URL } from '@/lib/env';

/**
 * The website's links that open the app directly (Universal Links on iOS, App Links on Android).
 * The email sign-in link and the trip invite link are website pages, so every mail app can open
 * them; on a phone with the app installed the system hands them to the app instead, and the page
 * (with its "Open in the app" button) is only the fallback. Keep this list in step with
 * `associatedDomains` and `intentFilters` in app.json and with the website's
 * apple-app-site-association and assetlinks.json files.
 */
export const WEBSITE_LINK_HOST = 'www.citiusholidays.com';

const WEB_LINK = /^https?:\/\/([^/?#]+)(\/[^?#]*)?(?:\?[^#]*)?(?:#(.*))?$/i;
const SIGN_IN_TOKEN = /^[A-Za-z0-9_-]{16,128}$/;
const TRAILING_SLASH = /\/+$/;

function hostOf(url: string) {
  return WEB_LINK.exec(url)?.[1]?.toLowerCase() ?? null;
}

/** The website hosts whose links this app answers: production, and the configured site (staging). */
function isWebsiteHost(host: string) {
  return host === WEBSITE_LINK_HOST || host === hostOf(WEBSITE_URL);
}

function tokenFrom(fragment: string | undefined) {
  const match = /(?:^|&)token=([^&]*)/.exec(fragment ?? '');
  if (!match?.[1]) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
}

/**
 * The app route for a link the system opened the app with. A website sign-in or invite link
 * becomes the matching screen with its token (the token rides in the URL fragment, which the
 * browser never sends to a server); any other website page opens the app's home. Everything else,
 * such as the app's own `citius://` links, passes through unchanged.
 */
export function appPathForSystemLink(path: string): string {
  const match = WEB_LINK.exec(path.trim());
  if (!match) return path;
  const [, host = '', page = '', fragment] = match;
  if (!isWebsiteHost(host.toLowerCase())) return path;
  const route = page.replace(TRAILING_SLASH, '');
  if (route === '/app/sign-in') {
    const token = tokenFrom(fragment);
    return SIGN_IN_TOKEN.test(token) ? `/sign-in?token=${encodeURIComponent(token)}` : '/sign-in';
  }
  if (route === '/app/invite') {
    const token = parseInviteToken(`#token=${tokenFrom(fragment)}`);
    // A broken link opens the invite screen, which says it doesn't work, signed in or not.
    return token ? `/invite?token=${token}` : '/invite';
  }
  return '/';
}
