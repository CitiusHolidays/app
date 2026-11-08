import { space, Text, useAppTheme } from '@citius/ui';
import { createContext, type ReactNode, use, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/kit';

const SHOWN_MS = 2800;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ENTER = FadeInDown.duration(240).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 16 }] });
const EXIT = FadeOutDown.duration(180).easing(EASE_OUT);
/** Sits above the floating tab bar. */
const TAB_BAR_CLEARANCE = 92;

interface Toast {
  id: number;
  text: string;
  tone: 'done' | 'saved';
}

const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => undefined);

/**
 * One short confirmation at a time, low on the screen: "Saved on this phone" when work is queued
 * offline, "Sent" when it went straight through. Screen readers hear it once. It never blocks a tap.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useMemo(() => (text: string, tone: Toast['tone'] = 'done') => setToast({ id: Date.now(), text, tone }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext value={show}>
      {children}
      <View pointerEvents="none" style={{ bottom: insets.bottom + TAB_BAR_CLEARANCE, left: theme.frame, position: 'absolute', right: theme.frame }}>
        {toast ? (
          <Animated.View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            entering={ENTER}
            exiting={EXIT}
            key={toast.id}
            style={{
              alignItems: 'center',
              alignSelf: 'center',
              backgroundColor: theme.color.dark,
              borderRadius: 999,
              flexDirection: 'row',
              gap: space.sm,
              maxWidth: 420,
              paddingHorizontal: space.lg,
              paddingVertical: space.sm + 2,
            }}
          >
            <Icon
              color={toast.tone === 'done' ? '#86efac' : theme.color.onDarkMuted}
              ios={toast.tone === 'done' ? 'checkmark.circle.fill' : 'iphone.and.arrow.forward'}
              md={toast.tone === 'done' ? 'check_circle' : 'save'}
              size={17}
            />
            <Text style={{ flexShrink: 1 }} tone="onDark" variant="secondary">
              {toast.text}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext>
  );
}

export function useToast() {
  return use(ToastContext);
}
