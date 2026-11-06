import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * `accessibilityLiveRegion` only works on Android. On iOS, a changed message is spoken to
 * VoiceOver explicitly. The first value is not announced: it is read with the screen.
 */
export function useAnnounce(message: string | null | undefined) {
  const previous = useRef(message);
  useEffect(() => {
    if (Platform.OS === 'ios' && message && message !== previous.current) {
      AccessibilityInfo.announceForAccessibility(message);
    }
    previous.current = message;
  }, [message]);
}
