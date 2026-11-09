import { space, Surface, useAppTheme } from '@citius/ui';
import type { DimensionValue } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { ListCard } from '@/components/kit';

/**
 * Stand-ins for the headcount hero and the traveller list while today's record is read from the
 * phone, at their real sizes. The batch chips and the Show switch need only the trip pack, so they
 * are real from the start and sit between these two, as they do once the record is read.
 */

/** Rows drawn while the record loads: enough to fill the first screen. */
const MAX_ROWS = 8;

/** One static bar, one text line tall (no shimmer, like the kit's PlaceholderBar). */
function Bar({ height, round, width }: { height: number; round?: boolean; width: DimensionValue }) {
  const theme = useAppTheme();
  return <View style={{ backgroundColor: theme.color.tickOff, borderRadius: round ? height / 2 : 6, height, opacity: 0.6, width }} />;
}

/** The hero's label, count, tick strip and status line. */
export function HeroSkeleton() {
  const theme = useAppTheme();
  return (
    <Surface style={{ gap: space.lg }} variant="hero">
      <View accessibilityLabel="Loading today's headcount" accessible style={{ gap: space.lg }}>
        {/* The label line holds an 18pt icon. */}
        <View style={{ height: Math.max(theme.type.label.lineHeight, 18), justifyContent: 'center' }}>
          <Bar height={theme.type.label.lineHeight} width="45%" />
        </View>
        <View style={{ gap: space.md }}>
          <Bar height={theme.type.answer.lineHeight} width="40%" />
          {/* The tick strip's own height. */}
          <Bar height={24} width="100%" />
        </View>
        <Bar height={theme.type.secondary.lineHeight} width="35%" />
      </View>
    </Surface>
  );
}

/** The first rows of the list: avatar, name and batch line, in the screen's 64pt row box. */
export function RowsSkeleton({ rows }: { rows: number }) {
  const theme = useAppTheme();
  const shown = Math.min(rows, MAX_ROWS);
  if (shown === 0) {
    return null;
  }
  return (
    <ListCard>
      {Array.from({ length: shown }, (_, index) => (
        <View
          importantForAccessibility="no-hide-descendants"
          key={index}
          style={[styles.row, { borderBottomColor: theme.color.rule, borderBottomWidth: index === shown - 1 ? 0 : StyleSheet.hairlineWidth }]}
        >
          <Bar height={40} round width={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Bar height={theme.type.rowTitle.lineHeight} width="55%" />
            <Bar height={theme.type.secondary.lineHeight} width="30%" />
          </View>
        </View>
      ))}
    </ListCard>
  );
}

/** The same row box as the screen's TravellerRow. */
const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: space.md, minHeight: 64, paddingVertical: space.md },
});
