import { Alert, Platform, Share } from 'react-native';

/**
 * Whether the message went out, after the share sheet closes. iOS says when the sheet was
 * dismissed. Android reports "shared" even when the tour manager backs out, so there the app asks
 * before it logs the announcement and sends it to the office.
 */
export function wasSent(result: { action: string }): Promise<boolean> {
  if (result.action === Share.dismissedAction) {
    return Promise.resolve(false);
  }
  if (Platform.OS !== 'android') {
    return Promise.resolve(true);
  }
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
