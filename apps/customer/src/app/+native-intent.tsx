import { appPathForSystemLink } from '@/features/links/website-links';

/**
 * Every link the system opens the app with passes through here first. Website sign-in and invite
 * links (Universal Links / App Links) are rewritten to the app's own screens.
 */
export function redirectSystemPath({ path }: { initial: boolean; path: string }) {
  try {
    return appPathForSystemLink(path);
  } catch {
    // Never crash on a strange link: open the app's home instead.
    return '/';
  }
}
