import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { logEvent } from './safe-log';

/** Haptics reject only in a build without the native module; the visual change still happens. */
function buzz(feedback: Promise<void>) {
  void feedback.catch((error: unknown) => logEvent('haptics.unavailable', error));
}

/** A success or error buzz; nothing on the web preview. */
export function haptic(kind: 'success' | 'error') {
  if (Platform.OS === 'web') return;
  buzz(Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error));
}

/** The lightest tick, for marking one traveller: one per tap, always alongside the visual change. */
export function tick() {
  if (Platform.OS === 'web') return;
  buzz(Haptics.selectionAsync());
}

/** A light tap as a pull-to-refresh commits, on the same frame the spinner starts. */
export function pull() {
  if (Platform.OS === 'web') return;
  buzz(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
