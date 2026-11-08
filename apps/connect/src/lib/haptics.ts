import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** A success or error buzz; nothing on the web preview, and a failed buzz is ignored. */
export function haptic(kind: 'success' | 'error') {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(
    kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
  ).catch(() => undefined);
}

/** The lightest tick, for marking one traveller: one per tap, always alongside the visual change. */
export function tick() {
  if (Platform.OS === 'web') return;
  void Haptics.selectionAsync().catch(() => undefined);
}
