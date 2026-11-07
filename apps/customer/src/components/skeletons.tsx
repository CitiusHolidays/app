import { space, useAppTheme } from '@citius/ui';
import type { ReactNode } from 'react';
import { type DimensionValue, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Loading states drawn as the screen they stand in for: each value is a flat bar at its real
 * size, so nothing moves when the data lands (no shimmer: app-screens §11). Bars on the night
 * ground are faint white; on paper they are the neutral tick grey.
 */
function Bar({ dark, height, radius = 6, width }: { dark?: boolean; height: number; radius?: number; width: DimensionValue }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        backgroundColor: dark ? 'rgba(255,255,255,0.14)' : theme.color.tickOff,
        borderRadius: radius,
        height,
        opacity: dark ? 1 : 0.55,
        width,
      }}
    />
  );
}

/** A trip photo card while it loads: the pill, group line, destination, dates and chevron. */
export function TripCardSkeleton({ lead }: { lead?: boolean }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        backgroundColor: theme.color.dark,
        borderRadius: theme.radius.hero,
        height: lead ? 460 : 300,
        justifyContent: 'space-between',
        padding: lead ? space.xl : space.lg + 4,
      }}
    >
      <Bar dark height={30} radius={15} width={120} />
      <View style={{ gap: space.sm }}>
        <Bar dark height={14} width="55%" />
        <Bar dark height={lead ? 44 : 36} width="60%" />
        <Bar dark height={14} width="70%" />
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingTop: space.xs,
          }}
        >
          <Bar dark height={12} width="45%" />
          <Bar dark height={48} radius={24} width={48} />
        </View>
      </View>
    </View>
  );
}

/** Journeys while the first answer is on its way: the lead card and one more. */
export function JourneysSkeleton({ label }: { label: string }) {
  return (
    <View accessibilityLabel={label} accessible style={{ gap: space.lg + 4 }}>
      <TripCardSkeleton lead />
      <TripCardSkeleton />
    </View>
  );
}

/** One announcement row: the orange rule, two lines of message, the sender line. */
export function AnnouncementSkeleton({ last }: { last?: boolean }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        borderBottomColor: theme.color.rule,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        flexDirection: 'row',
        gap: space.md,
        paddingVertical: space.md,
      }}
    >
      <View
        style={{
          backgroundColor: theme.color.tickOff,
          borderRadius: 2,
          opacity: 0.55,
          width: 3,
        }}
      />
      <View style={{ flex: 1, gap: space.sm }}>
        <Bar height={16} width="95%" />
        <Bar height={16} width="70%" />
        <Bar height={12} width="40%" />
      </View>
    </View>
  );
}

/**
 * The trip screen: photo header with its title block, then the sheet with Today and contacts. The
 * screen's own back button stays usable over it, so a slow answer never traps the traveller.
 */
export function TripSkeleton({ back, label }: { back?: ReactNode; label: string }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: theme.color.ground, flex: 1 }}>
      <View accessibilityLabel={label} accessible style={{ flex: 1 }}>
        <View
          style={{
            backgroundColor: theme.color.dark,
            gap: space.sm,
            justifyContent: 'flex-end',
            minHeight: insets.top + 470,
            paddingBottom: space.xxl + space.xl,
            paddingHorizontal: theme.frame,
          }}
        >
          <Bar dark height={30} radius={15} width={130} />
          <Bar dark height={16} width="55%" />
          <Bar dark height={46} width="50%" />
          <Bar dark height={17} width="75%" />
          <View
            style={{
              flexDirection: 'row',
              gap: space.sm,
              paddingTop: space.xs,
            }}
          >
            <Bar dark height={30} radius={15} width={150} />
            <Bar dark height={30} radius={15} width={90} />
          </View>
        </View>
        <View
          style={{
            backgroundColor: theme.color.ground,
            borderTopLeftRadius: theme.radius.hero,
            borderTopRightRadius: theme.radius.hero,
            gap: space.lg + 4,
            marginTop: -theme.radius.hero - space.sm,
            paddingHorizontal: theme.frame,
            paddingTop: space.xl,
          }}
        >
          <View
            style={{
              borderColor: theme.color.border,
              borderRadius: theme.radius.hero,
              borderWidth: 1.5,
              gap: space.sm,
              padding: space.xl - 4,
            }}
          >
            <Bar height={18} width="45%" />
            <Bar height={22} width="25%" />
            <Bar height={17} width="95%" />
            <Bar height={17} width="80%" />
          </View>
          <Bar height={22} width="35%" />
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: space.md,
            }}
          >
            <Bar height={44} radius={22} width={44} />
            <View style={{ flex: 1, gap: space.xs }}>
              <Bar height={17} width="50%" />
              <Bar height={14} width="40%" />
            </View>
            <Bar height={48} radius={24} width={48} />
          </View>
        </View>
      </View>
      {back ? (
        <View
          style={{
            left: theme.frame,
            position: 'absolute',
            top: insets.top + space.sm,
          }}
        >
          {back}
        </View>
      ) : null}
    </View>
  );
}

/** The day-by-day plan: numbered stops on a line, each with a day heading and two lines of text. */
export function PlanSkeleton({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <View accessibilityLabel={label} accessible style={{ gap: space.xl }}>
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={{ flexDirection: 'row', gap: space.md }}>
          <View
            style={{
              borderColor: theme.color.tickOff,
              borderRadius: 14,
              borderWidth: 2,
              height: 28,
              width: 28,
            }}
          />
          <View style={{ flex: 1, gap: space.sm }}>
            <Bar height={17} width="40%" />
            <Bar height={17} width="95%" />
            <Bar height={17} width="70%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** The invite: greeting, the destination card and the paragraph under it. */
export function InviteSkeleton({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <View accessibilityLabel={label} accessible style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <Bar height={12} width={90} />
        <Bar height={40} width="60%" />
      </View>
      <View
        style={{
          backgroundColor: theme.color.dark,
          borderRadius: theme.radius.hero,
          gap: space.sm,
          height: 300,
          justifyContent: 'flex-end',
          padding: space.xl,
        }}
      >
        <Bar dark height={42} width="45%" />
        <Bar dark height={17} width="60%" />
      </View>
      <View style={{ gap: space.sm }}>
        <Bar height={17} width="95%" />
        <Bar height={17} width="85%" />
      </View>
    </View>
  );
}
