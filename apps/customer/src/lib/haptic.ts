import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** A success or error tap, where the phone has a haptic engine; never throws. */
export function haptic(kind: 'success' | 'error') {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(
    kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
  ).catch(() => undefined);
}
