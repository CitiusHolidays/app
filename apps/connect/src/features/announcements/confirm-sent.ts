import { Alert, AppState, Platform, Share } from 'react-native';

/** How long the share sheet gets to cover the app before the app asks anyway. */
const SHEET_OPENS_WITHIN_MS = 1500;

/**
 * Resolves once the app is in front again after the share sheet. Android's share call returns as
 * soon as the sheet starts opening, and an alert raised then is lost behind the sheet.
 */
function backFromShareSheet(): Promise<void> {
  return new Promise((resolve) => {
    let covered = false;
    const finish = () => {
      clearTimeout(neverCovered);
      subscription.remove();
      resolve();
    };
    // If the sheet never covers the app (it failed to open), ask anyway.
    const neverCovered = setTimeout(finish, SHEET_OPENS_WITHIN_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        covered = true;
        clearTimeout(neverCovered);
      } else if (covered) {
        finish();
      }
    });
  });
}

/**
 * Whether the message went out, after the share sheet closes. iOS says when the sheet was
 * dismissed. Android reports "shared" even when the tour manager backs out, so there the app asks
 * before it logs the announcement and sends it to the office.
 */
export async function wasSent(result: { action: string }): Promise<boolean> {
  if (result.action === Share.dismissedAction) {
    return false;
  }
  if (Platform.OS !== 'android') {
    return true;
  }
  await backFromShareSheet();
  return new Promise((resolve) => {
    Alert.alert(
      'Did you send it?',
      'Android does not tell the app whether the message went out. It is logged, and sent to the office, only if you sent it.',
      [
        { onPress: () => resolve(false), style: 'cancel', text: 'Not sent' },
        { onPress: () => resolve(true), text: 'Yes, sent' },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
