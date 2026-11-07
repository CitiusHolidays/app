import { space, Surface, Text, useAppTheme } from '@citius/ui';
import { View, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

/** A slow breathe between two opacities, run by Reanimated's CSS animations on the UI thread. */
const BREATHE = { from: { opacity: 0.55 }, to: { opacity: 0.9 } } as const;

/**
 * Stands in for a passport scan while it downloads: the shape of a passport data page (photo,
 * details, the two machine-readable lines) at the scan's own aspect ratio, so nothing jumps when
 * the scan arrives. Pulses gently unless the phone asks for reduced motion.
 */
export function PassportSkeleton({ aspectRatio = 1.42 }: { aspectRatio?: number }) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const breathing = reduced
    ? { opacity: 0.7 }
    : {
        animationDirection: 'alternate' as const,
        animationDuration: '900ms',
        animationIterationCount: 'infinite' as const,
        animationName: BREATHE,
        animationTimingFunction: 'ease-in-out' as const,
      };
  const block = (style: ViewStyle) => <View style={[{ backgroundColor: theme.color.tickOff, borderRadius: 4 }, style]} />;

  return (
    <Surface style={{ gap: space.sm, padding: space.sm }}>
      <Animated.View
        accessibilityLabel="Loading passport"
        accessible
        style={[
          {
            aspectRatio,
            backgroundColor: theme.color.inset,
            borderRadius: theme.radius.inset,
            gap: '6%',
            overflow: 'hidden',
            padding: '5%',
            width: '100%',
          },
          breathing,
        ]}
      >
        {block({ height: '7%', width: '55%' })}
        <View style={{ flex: 1, flexDirection: 'row', gap: '5%' }}>
          {block({ height: '100%', width: '30%' })}
          <View style={{ flex: 1, gap: '9%', justifyContent: 'center' }}>
            {block({ height: '10%', width: '70%' })}
            {block({ height: '10%', width: '90%' })}
            {block({ height: '10%', width: '60%' })}
            {block({ height: '10%', width: '80%' })}
          </View>
        </View>
        <View style={{ gap: '5%' }}>
          {block({ height: 7, width: '100%' })}
          {block({ height: 7, width: '100%' })}
        </View>
      </Animated.View>
      <Text accessibilityElementsHidden importantForAccessibility="no" variant="secondary">
        Loading the passport. It is never saved on this phone.
      </Text>
    </Surface>
  );
}
