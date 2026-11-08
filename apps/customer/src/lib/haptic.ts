import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * A tap where the phone has a haptic engine; never throws. One per user action, in the same frame
 * as its visual, and never the only feedback:
 * - `success` / `error`: the outcome of something the traveller sent or confirmed;
 * - `selection`: a choice ticks over (a sign-in method, a consent tick);
 * - `light`: something commits under the finger (a pull to refresh lets go).
 */
export function haptic(kind: 'success' | 'error' | 'selection' | 'light') {
  if (Platform.OS === 'web') return;
  let tap: Promise<void>;
  if (kind === 'selection') tap = Haptics.selectionAsync();
  else if (kind === 'light') tap = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else tap = Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
  void tap.catch(() => undefined);
}
