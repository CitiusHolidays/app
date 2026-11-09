import { face, PressableScale, space, Surface, Text, useAppTheme } from '@citius/ui';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps, ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FADE_IN } from '@/components/motion';
import { initials } from '@/lib/initials';
import { openUrl } from '@/lib/open-url';
import { useRevealEndOnKeyboard } from '@/lib/use-reveal-end-on-keyboard';

/** Room under the content for the floating tab bar. */
export const TAB_BAR_CLEARANCE = 96;

/** A scrolling screen on the stone ground, opening with an optional `header`. */
export function Screen({
  children,
  form = false,
  header,
  tabBar = true,
  ...rest
}: ScrollViewProps & {
  children: ReactNode;
  /** A screen with a text field: it stays above the keyboard, with its last button in sight. */
  form?: boolean;
  header?: ReactNode;
  /** False for stack screens without the tab bar underneath. */
  tabBar?: boolean;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const opens = Boolean(header);
  const { keyboardInset, props: reveal } = useRevealEndOnKeyboard({ active: form, pad: Platform.OS === 'android' });
  return (
    <ScrollView
      // iOS insets the scroll view by the keyboard itself, which is right inside sheets too.
      automaticallyAdjustKeyboardInsets={form}
      contentContainerStyle={{
        gap: space.lg + 4,
        paddingBottom: insets.bottom + (tabBar ? TAB_BAR_CLEARANCE : space.xxl) + keyboardInset,
        paddingHorizontal: theme.frame,
        // iOS tab screens let the system inset the content for the status bar ('automatic');
        // Android tab screens and header-less stack screens pad for it themselves.
        paddingTop: !tabBar && opens ? insets.top + space.lg : tabBar && Platform.OS !== 'ios' ? insets.top + space.md : space.sm,
      }}
      contentInsetAdjustmentBehavior={tabBar ? 'automatic' : 'never'}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.color.ground }}
      {...(form ? reveal : null)}
      {...rest}
    >
      {header}
      {children}
    </ScrollView>
  );
}

/**
 * The screen's opening: an optional mono kicker (a date line) over a serif title and
 * an optional muted meta line. Read as one heading. Stack screens with a native header use it as
 * their first child so the top inset is not added twice.
 */
export function PageTitle({ kicker, meta, title }: { kicker?: string; meta?: string; title: string }) {
  return (
    <View
      accessible
      accessibilityLabel={[title, kicker, meta].filter(Boolean).join(', ')}
      accessibilityRole="header"
      style={{ gap: space.xs + 2 }}
    >
      {kicker ? (
        <Text numberOfLines={1} tone="muted" variant="mono">
          {kicker}
        </Text>
      ) : null}
      <Text variant="display">{title}</Text>
      {meta ? (
        <Text tone="muted" variant="secondary">
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

const TINT_HEIGHT = 360;

/**
 * A faint Citius-blue wash that fades into the stone ground from the top of the screen. Stacked
 * bands stand in for a gradient; at these opacities the steps do not show.
 */
export function TopTint() {
  const theme = useAppTheme();
  const bands = 18;
  return (
    <View importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ height: TINT_HEIGHT, left: 0, position: 'absolute', right: 0, top: 0 }}>
      {Array.from({ length: bands }, (_, index) => (
        <View
          key={index}
          style={{ backgroundColor: theme.color.accent, flex: 1, opacity: 0.1 * (1 - index / bands) ** 1.6 }}
        />
      ))}
    </View>
  );
}

/**
 * The frame for screens that only say one thing (refusals, the error screen): the tinted ground,
 * a mark, a serif title, one sentence and its actions, centred on the screen.
 */
export function MessageScreen({
  actions,
  icon,
  kicker,
  text,
  title,
}: {
  actions: ReactNode;
  icon: IconPair;
  kicker?: string;
  text: string;
  title: string;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: theme.color.ground, flex: 1 }}>
      <TopTint />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          gap: space.xl,
          justifyContent: 'center',
          paddingBottom: insets.bottom + space.xxl,
          paddingHorizontal: theme.frame + space.xs,
          paddingTop: insets.top + space.xxl,
        }}
        contentInsetAdjustmentBehavior="never"
      >
        <View style={{ alignItems: 'center', gap: space.lg }}>
          {/* Refusals and errors arrive plainly: the mark fades in (150ms), and the words and the way
              out are there at once, so the next tap is never held back. */}
          <Animated.View
            entering={FADE_IN}
            style={{
              alignItems: 'center',
              backgroundColor: theme.color.card,
              borderColor: theme.color.border,
              borderRadius: 28,
              borderWidth: StyleSheet.hairlineWidth,
              height: 56,
              justifyContent: 'center',
              width: 56,
            }}
          >
            <Icon ios={icon.ios} md={icon.md} size={24} />
          </Animated.View>
          <View accessible accessibilityRole="header" style={{ alignItems: 'center', gap: space.xs + 2 }}>
            {kicker ? (
              <Text tone="muted" variant="mono">
                {kicker}
              </Text>
            ) : null}
            <Text style={{ textAlign: 'center' }} variant="display">
              {title}
            </Text>
          </View>
          <Text style={{ maxWidth: 340, textAlign: 'center' }}>{text}</Text>
        </View>
        <View style={{ gap: space.sm }}>{actions}</View>
      </ScrollView>
    </View>
  );
}

/** A section heading with an optional trailing text action ("See all"). */
export function SectionTitle({ action, children }: { action?: { label: string; onPress: () => void }; children: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text accessibilityRole="header" variant="section">
        {children}
      </Text>
      {action ? (
        <PressableScale accessibilityRole="button" hitSlop={10} onPress={action.onPress}>
          <Text tone="accent" variant="label">
            {action.label}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

type SymbolName = ComponentProps<typeof SymbolView>['name'];

/** An icon named in both systems: an SF Symbol and a Material Symbol. */
export interface IconPair {
  ios: string;
  md: string;
}

/** One icon in two systems: an SF Symbol on iOS, a Material Symbol on Android and web. */
export function Icon({ color, ios, md, size = 20 }: { color?: string; ios: string; md: string; size?: number }) {
  const theme = useAppTheme();
  return (
    <SymbolView
      name={{ android: md, ios, web: md } as SymbolName}
      size={size}
      tintColor={color ?? theme.color.ink}
      weight="medium"
    />
  );
}

export function TextField({ label, style, ...rest }: TextInputProps & { label: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.color.muted}
        style={[
          {
            backgroundColor: theme.color.surface,
            borderColor: theme.color.controlBorder,
            borderRadius: theme.radius.control,
            borderWidth: 1,
            color: theme.color.ink,
            ...face(theme, 'regular'),
            fontSize: 17,
            minHeight: 50,
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

/** A person: an initials circle. */
export function Avatar({ name, size = 40, tone = 'light' }: { name: string; size?: number; tone?: 'light' | 'dark' }) {
  const theme = useAppTheme();
  const dark = tone === 'dark';
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ height: size, width: size }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: dark ? '#1a2035' : theme.color.inset,
          borderColor: dark ? '#2b3352' : theme.color.border,
          borderRadius: size / 2,
          borderWidth: 1,
          height: size,
          justifyContent: 'center',
          width: size,
        }}
      >
        <Text style={{ fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.44) }} tone={dark ? 'onDark' : 'ink'} variant="label">
          {initials(name)}
        </Text>
      </View>
    </View>
  );
}

/** A card that holds a list of rows separated by inset rules. */
export function ListCard({ children }: { children: ReactNode }) {
  return <Surface style={{ paddingHorizontal: space.lg, paddingVertical: 2 }}>{children}</Surface>;
}

/**
 * A row with an optional leading slot, a title, a subtitle and an optional trailing element.
 * With `onPress` the whole row is one button. Without it, the text is one accessibility element
 * and the trailing element (a Call button, say) stays separately reachable: an `accessible`
 * wrapper would hide it from VoiceOver.
 */
export function Row({
  chevron,
  last,
  leading,
  onPress,
  subtitle,
  title,
  trailing,
}: {
  chevron?: boolean;
  /** The last row in a card draws no rule under it. */
  last?: boolean;
  leading?: ReactNode;
  onPress?: () => void;
  subtitle?: string;
  title: string;
  trailing?: ReactNode;
}) {
  const theme = useAppTheme();
  const text = (
    <>
      <Text numberOfLines={2} variant="rowTitle">
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={2} variant="secondary" tone="muted">
          {subtitle}
        </Text>
      ) : null}
    </>
  );
  const rowStyle = [
    styles.row,
    { borderBottomColor: theme.color.rule, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, minHeight: 60 },
  ];
  const end = (
    <>
      {trailing}
      {chevron ? <Icon color={theme.color.muted} ios="chevron.right" md="chevron_right" size={14} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={rowStyle}>
        {leading}
        <View
          accessible
          accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
          style={styles.rowText}
        >
          {text}
        </View>
        {end}
      </View>
    );
  }
  return (
    <PressableScale accessibilityLabel={title} accessibilityRole="button" onPress={onPress}>
      <View style={rowStyle}>
        {leading}
        <View style={styles.rowText}>{text}</View>
        {end}
      </View>
    </PressableScale>
  );
}

/** A round 44pt call button with a phone glyph. */
export function CallButton({ label, phone }: { label: string; phone: string }) {
  const theme = useAppTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={4}
      onPress={() => openUrl(`tel:${phone.replace(/[^\d+]/g, '')}`)}
      style={{
        alignItems: 'center',
        backgroundColor: theme.color.surface,
        borderColor: theme.color.border,
        borderRadius: 22,
        borderWidth: 1,
        height: theme.minTarget,
        justifyContent: 'center',
        width: theme.minTarget,
      }}
    >
      <Icon color={theme.color.primary} ios="phone.fill" md="call" size={18} />
    </PressableScale>
  );
}

/** One quiet sentence with one mark: an empty state inside its block. */
export function QuietState({ text }: { text: string }) {
  const theme = useAppTheme();
  return (
    <View accessible accessibilityLabel={text} style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.color.inset,
          borderRadius: 18,
          height: 36,
          justifyContent: 'center',
          width: 36,
        }}
      >
        <Icon color={theme.color.muted} ios="minus" md="remove" size={15} />
      </View>
      <Text style={{ maxWidth: 280, textAlign: 'center' }} tone="muted" variant="secondary">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
  },
  rowText: { flex: 1, gap: 2 },
  sectionTitle: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
});
