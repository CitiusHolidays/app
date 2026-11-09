import { space, Surface, Text, useAppTheme } from '@citius/ui';
import { createContext, type ReactNode, useContext, useEffect } from 'react';
import { type DimensionValue, StyleSheet, type TextStyle, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DESTINATION_TYPE } from '@/components/destination-type';
import { ListCard } from '@/components/kit';

/**
 * Loading states drawn as the screen they stand in for, so nothing moves when the data lands.
 * Every line of text is an invisible line of the same type with a bar drawn across it: Dynamic
 * Type and the taller Indic line heights size the placeholder exactly as they size the real text.
 * While they wait the bars breathe slowly (opacity only, one loop for the whole screen; still
 * under reduced motion), so a slow 3G answer reads as on its way rather than stuck. Bars on the
 * night ground are faint white; on paper they are the neutral tick grey. No shimmer sweep.
 */

type Variant = NonNullable<Parameters<typeof Text>[0]['variant']>;

const PulseContext = createContext<SharedValue<number> | null>(null);

/** One breath shared by every bar under it. */
function Pulse({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    opacity.set(withRepeat(withTiming(0.55, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => cancelAnimation(opacity);
  }, [opacity, reduced]);
  return <PulseContext.Provider value={opacity}>{children}</PulseContext.Provider>;
}

/** A placeholder fill. Its size comes from `style`, or from an invisible line inside it. */
function Block({ children, dark, style }: { children?: ReactNode; dark?: boolean; style?: ViewStyle }) {
  const theme = useAppTheme();
  const pulse = useContext(PulseContext);
  const breath = useAnimatedStyle(() => ({ opacity: (pulse ? pulse.get() : 1) * (dark ? 1 : 0.55) }));
  return (
    <Animated.View style={[{ backgroundColor: dark ? 'rgba(255,255,255,0.14)' : theme.color.tickOff, borderRadius: 6 }, style, breath]}>
      {children}
    </Animated.View>
  );
}

/** Holds exactly one line of `variant` (with `style`), drawing nothing. */
function Ghost({ style, variant }: { style?: TextStyle; variant?: Variant }) {
  return (
    <Text accessibilityElementsHidden importantForAccessibility="no" style={[style, { color: 'transparent' }]} variant={variant}>
      {' '}
    </Text>
  );
}

/** One line of text at its real height, with the bar across the middle of it. */
function Line({ dark, style, variant, width }: { dark?: boolean; style?: TextStyle; variant?: Variant; width: DimensionValue }) {
  return (
    <View style={{ width }}>
      <Ghost style={style} variant={variant} />
      <Block dark={dark} style={{ bottom: '18%', left: 0, position: 'absolute', right: 0, top: '18%' }} />
    </View>
  );
}

/** A paragraph: full lines, then a shorter last one. */
function Paragraph({ last = '70%', lines = 2, variant }: { last?: DimensionValue; lines?: number; variant?: Variant }) {
  return (
    <View>
      {Array.from({ length: lines }, (_, index) => (
        <Line key={index} variant={variant} width={index === lines - 1 ? last : '95%'} />
      ))}
    </View>
  );
}

/** A pill holding one label line (the timing pill, a chip). */
function Pill({ dark, paddingVertical = 6, width }: { dark?: boolean; paddingVertical?: number; width: number }) {
  return (
    <Block dark={dark} style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical, width }}>
      <Ghost variant="label" />
    </Block>
  );
}

/** A full-width button: at least 48pt, taller when its label grows with Dynamic Type. */
function ButtonBlock() {
  return (
    <Block style={{ borderRadius: 999, justifyContent: 'center', minHeight: 48, paddingVertical: space.sm }}>
      <Ghost variant="bodyStrong" />
    </Block>
  );
}

function Circle({ dark, size }: { dark?: boolean; size: number }) {
  return <Block dark={dark} style={{ borderRadius: size / 2, height: size, width: size }} />;
}

/** A section heading line (`SectionTitle`). */
function SectionLine({ width = '40%' }: { width?: DimensionValue }) {
  return <Line variant="section" width={width} />;
}

/** A trip photo card while it loads: the pill, group line, destination, dates and the people row. */
function TripCardSkeleton({ lead }: { lead?: boolean }) {
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
      <Pill dark width={120} />
      <View style={{ gap: space.sm }}>
        <Line dark variant="secondary" width="55%" />
        <Line dark style={lead ? DESTINATION_TYPE.leadCard : undefined} variant="display" width="60%" />
        <Line dark variant="secondary" width="70%" />
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.md, paddingTop: space.xs }}>
          <View style={{ flex: 1 }}>
            <Line dark variant="label" width="60%" />
          </View>
          <Circle dark size={48} />
        </View>
      </View>
    </View>
  );
}

/**
 * Journeys while the first answer is on its way, row for row as the list draws it: the lead card,
 * the "Upcoming" heading and the next card.
 */
export function JourneysSkeleton({ label }: { label: string }) {
  return (
    <Pulse>
      <View accessibilityLabel={label} accessible>
        <TripCardSkeleton lead />
        <View style={{ paddingBottom: space.md, paddingTop: space.md + space.lg }}>
          <SectionLine width="35%" />
        </View>
        <TripCardSkeleton />
      </View>
    </Pulse>
  );
}

/** One message row: the orange rule, a two-line message and the sender line. */
function AnnouncementRow({ last }: { last?: boolean }) {
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
      <Block style={{ borderRadius: 2, marginTop: 6, width: 3 }} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Paragraph />
        <Line variant="label" width="40%" />
      </View>
    </View>
  );
}

/** `count` message rows, for a card that holds a trip's updates. */
export function AnnouncementRows({ count, label }: { count: number; label: string }) {
  return (
    <Pulse>
      <View accessibilityLabel={label} accessible>
        {Array.from({ length: count }, (_, index) => (
          <AnnouncementRow key={index} last={index === count - 1} />
        ))}
      </View>
    </Pulse>
  );
}

/** The Updates tab while trips load: one trip's heading, its dates and its first messages. */
export function UpdatesSkeleton({ label }: { label: string }) {
  return (
    <Pulse>
      <View accessibilityLabel={label} accessible style={{ gap: space.sm }}>
        <SectionLine width="45%" />
        <Line variant="label" width="35%" />
        <ListCard>
          <AnnouncementRow />
          <AnnouncementRow last />
        </ListCard>
      </View>
    </Pulse>
  );
}

/**
 * The trip screen's photo header, for a trip the phone knows nothing about yet (opened from a link
 * before the trip list arrived). The back button is the real one, in its real place.
 */
export function TripHeroSkeleton({ back }: { back: ReactNode }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pulse>
      <View style={{ backgroundColor: theme.color.dark, minHeight: insets.top + 470 }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'space-between',
            paddingBottom: space.xxl + space.xl,
            paddingHorizontal: theme.frame,
            paddingTop: insets.top + space.sm,
          }}
        >
          {back}
          <View style={{ gap: space.sm }}>
            <Pill dark width={130} />
            <View style={{ gap: space.xs }}>
              <Line dark variant="secondary" width="55%" />
              <Line dark style={DESTINATION_TYPE.hero} variant="display" width="55%" />
              <Line dark width="75%" />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, paddingTop: space.xs }}>
              <Pill dark paddingVertical={5} width={150} />
              <Pill dark paddingVertical={5} width={90} />
            </View>
          </View>
        </View>
      </View>
    </Pulse>
  );
}

/** A tour manager row: avatar, name, role and phone, and the call button. */
function ContactRowSkeleton() {
  const theme = useAppTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        borderBottomColor: theme.color.rule,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        gap: space.md,
        paddingVertical: space.md,
      }}
    >
      <Circle size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Line variant="rowTitle" width="55%" />
        <Line variant="secondary" width="70%" />
        <Line variant="label" width="40%" />
      </View>
      <Circle size={theme.minTarget} />
    </View>
  );
}

/** The office email row that closes the contacts card. */
function EmailRowSkeleton() {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.md, minHeight: 60, paddingVertical: space.md }}>
      <Block style={{ height: 20, width: 20 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Line variant="rowTitle" width="50%" />
        <Line variant="secondary" width="65%" />
      </View>
    </View>
  );
}

/**
 * The trip screen's sheet while the trip's detail is on its way: Today (only for a trip under
 * way, as on the real screen), who to call, and the latest updates. It goes inside the screen's
 * own sheet, so the sheet itself never moves.
 */
export function TripSheetSkeleton({ label, ongoing }: { label: string; ongoing: boolean }) {
  const theme = useAppTheme();
  return (
    <Pulse>
      <View accessibilityLabel={label} accessible style={{ gap: space.lg + 4 }}>
        {ongoing ? (
          <Surface style={{ borderColor: theme.color.primary, borderWidth: 1.5, gap: space.sm }} variant="hero">
            <Line variant="bodyStrong" width="45%" />
            <Line variant="section" width="30%" />
            <Paragraph />
            <Paragraph last="55%" variant="secondary" />
          </Surface>
        ) : null}
        <View style={{ gap: space.sm }}>
          <SectionLine />
          <ListCard>
            <ContactRowSkeleton />
            <EmailRowSkeleton />
          </ListCard>
        </View>
        <View style={{ gap: space.sm }}>
          <SectionLine width="30%" />
          <ListCard>
            <AnnouncementRow />
            <AnnouncementRow last />
          </ListCard>
        </View>
      </View>
    </Pulse>
  );
}

/** The day-by-day plan: its title block, then numbered stops on a line, as the plan draws them. */
export function PlanSkeleton({ label }: { label: string }) {
  const theme = useAppTheme();
  const stops = 4;
  return (
    <Pulse>
      <View accessibilityLabel={label} accessible style={{ gap: space.lg + 4 }}>
        <View style={{ gap: space.xs + 2 }}>
          <Line variant="mono" width="35%" />
          <Line variant="display" width="70%" />
          <Line variant="secondary" width="50%" />
        </View>
        <View>
          {Array.from({ length: stops }, (_, index) => {
            const last = index === stops - 1;
            return (
              <View key={index} style={{ flexDirection: 'row', gap: space.md }}>
                <View style={{ alignItems: 'center', width: 28 }}>
                  <View style={{ borderColor: theme.color.tickOff, borderRadius: 14, borderWidth: 2, height: 28, marginTop: 2, width: 28 }} />
                  {last ? null : <View style={{ backgroundColor: theme.color.border, flex: 1, marginVertical: 4, width: StyleSheet.hairlineWidth * 2 }} />}
                </View>
                <View style={{ flex: 1, gap: space.xs, paddingBottom: last ? 0 : space.xl }}>
                  <Line variant="bodyStrong" width="40%" />
                  <Paragraph />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </Pulse>
  );
}

/** The invite: kicker and greeting, the destination card and the paragraph under it. */
export function InviteSkeleton({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <Pulse>
      <View accessibilityLabel={label} accessible style={{ gap: space.xl }}>
        <View style={{ gap: space.sm }}>
          <Line variant="mono" width={90} />
          <Line variant="display" width="60%" />
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
          <Line dark style={DESTINATION_TYPE.invite} variant="display" width="45%" />
          <Line dark width="60%" />
        </View>
        <Paragraph last="85%" />
      </View>
    </Pulse>
  );
}

/** The delete-account step while it is checked: shaped as "Confirm it's you", the usual first step. */
export function DeletionStepSkeleton({ label }: { label: string }) {
  return (
    <Pulse>
      <View accessibilityLabel={label} accessible style={{ gap: space.md }}>
        <SectionLine width="55%" />
        <Paragraph />
        <ButtonBlock />
      </View>
    </Pulse>
  );
}
