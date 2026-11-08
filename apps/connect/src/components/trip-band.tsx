import { space, Text, useAppTheme } from '@citius/ui';
import { View } from 'react-native';

import { DestinationCover } from '@/components/destination-cover';
import type { DestinationPhoto } from '@/features/trips/cover';

/**
 * A screen's opening on the trip's own photo: a mono kicker over a serif title and a meta line,
 * in white on the darkened foot of the picture. Read as one heading. The photo is the one saved
 * with the trip pack, so it opens offline.
 */
export function TripBand({ cover, kicker, meta, title }: { cover: DestinationPhoto | null; kicker: string; meta: string; title: string }) {
  const theme = useAppTheme();
  return (
    <View
      accessibilityLabel={[title, kicker, meta].join(', ')}
      accessibilityRole="header"
      accessible
      style={{ borderRadius: theme.radius.hero, minHeight: 196, overflow: 'hidden' }}
    >
      <DestinationCover photo={cover} />
      <View style={{ flex: 1, gap: space.xs, justifyContent: 'flex-end', padding: space.lg + 2 }}>
        <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.86)' }} variant="mono">
          {kicker}
        </Text>
        <Text numberOfLines={2} style={{ color: '#ffffff' }} variant="display">
          {title}
        </Text>
        <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.82)' }} variant="secondary">
          {meta}
        </Text>
      </View>
    </View>
  );
}
