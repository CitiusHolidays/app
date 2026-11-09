import { type TypeScale, useAppTheme } from '@citius/ui';
import { type DimensionValue, View, type ViewStyle } from 'react-native';

/** A static block in the skeleton colour; no shimmer, like the kit's Placeholder. */
export function SkeletonBlock({ style }: { style: ViewStyle }) {
  const theme = useAppTheme();
  return <View style={[{ backgroundColor: theme.color.tickOff, borderRadius: 6, opacity: 0.6 }, style]} />;
}

/**
 * One line of text in a theme type role while it loads: the line's own height from the theme, with
 * a bar the size of its letters, so the loaded text takes exactly the space the bar held.
 */
export function SkeletonLine({ variant, width }: { variant: keyof TypeScale; width: DimensionValue }) {
  const theme = useAppTheme();
  const role = theme.type[variant];
  return (
    <View style={{ height: role.lineHeight, justifyContent: 'center', width }}>
      <SkeletonBlock style={{ height: Math.round(role.fontSize * 0.8) }} />
    </View>
  );
}
