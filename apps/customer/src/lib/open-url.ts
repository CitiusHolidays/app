import { Linking } from 'react-native';

import { logEvent } from './safe-log';

/** Hands a mailto:, tel: or web link to the system. A phone with no app for it logs and stays put. */
export function openUrl(url: string) {
  void Linking.openURL(url).catch((error: unknown) => logEvent('link.open-failed', error));
}
