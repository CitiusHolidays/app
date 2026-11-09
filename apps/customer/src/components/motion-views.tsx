import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePop, useRiseIn } from '@/components/motion';

/** One line of a short group arriving together, `index` places it in the stagger. */
export function Rise({ children, delay, index = 0, style }: { children: ReactNode; delay?: number; index?: number; style?: StyleProp<ViewStyle> }) {
  const entering = useRiseIn(index, delay);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

/** A rare moment's mark (a success badge, an empty state's icon) popping into place once. */
export function Pop({ children, delay, duration, style }: { children: ReactNode; delay?: number; duration?: number; style?: StyleProp<ViewStyle> }) {
  const pop = usePop(delay, duration);
  return <Animated.View style={[style, pop]}>{children}</Animated.View>;
}
