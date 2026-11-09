import { face, PressableScale, space, Surface, Text, useAppTheme } from '@citius/ui';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { type ComponentProps, type ComponentRef, type ReactNode, type Ref, useState } from 'react';
import {
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { cubicBezier, Easing, LayoutAnimationConfig, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ARRIVE, ROLL_DOWN, ROLL_UP, rollsUp } from '@/lib/motion';

/** A small overshoot for a check landing: the one place Connect lets something bounce. */
const POP = cubicBezier(0.34, 1.56, 0.64, 1);
/** Strong ease-in-out for things that move across the screen. */
const EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);
const SEAL_IN = ZoomIn.duration(320).easing(Easing.bezier(0.34, 1.56, 0.64, 1)).withInitialValues({ transform: [{ scale: 0.6 }] });

/**
 * Room kept between a focused field and the keyboard: a line of helper text and the form's button
 * under it (headcount's "Start new stop", an expense's "Save expense"), so the next tap is in view.
 */
const KEYBOARD_CLEARANCE = 152;
/** Room under the content for the floating tab bar. */
const TAB_BAR_CLEARANCE = 96;
/**
 * The lift under a selected segment: black at 8%, 1pt down, a 6px blur. React Native draws the
 * blur at half its radius on iOS, so this is the earlier iOS-only shadow (radius 3), now on Android too.
 */
const SELECTED_TAB_SHADOW = '0 1px 6px rgba(0, 0, 0, 0.08)';

/**
 * Room above or below scrolling content. Safe-area insets go in spacers, not in the scroll view's
 * content padding, so the content container's style never changes as the insets settle.
 */
function Spacer({ height }: { height: number }) {
  return <View importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ height }} />;
}

/**
 * A scrolling screen on the stone ground. A titled screen opens with an optional mono kicker
 * (date line, Job Card code) over a serif title; `header` replaces both for custom openings.
 */
export function Screen({
  children,
  header,
  kicker,
  onRefresh,
  refreshing,
  tabBar = true,
  title,
  ...rest
}: ScrollViewProps & {
  children: ReactNode;
  header?: ReactNode;
  kicker?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** False for stack screens without the tab bar underneath. */
  tabBar?: boolean;
  title?: string;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const opens = Boolean(title || header);
  // iOS tab screens let the system inset the content for the status bar ('automatic');
  // Android tab screens and header-less stack screens make room for it themselves.
  const top = !tabBar && opens ? insets.top + space.lg : tabBar && Platform.OS !== 'ios' ? insets.top + space.md : space.sm;
  // Keyboard-aware: a focused field (headcount's next stop, an expense's description) scrolls clear
  // of the keyboard with room for the row under it, in step with the keyboard itself.
  return (
    <KeyboardAwareScrollView
      bottomOffset={KEYBOARD_CLEARANCE}
      contentContainerStyle={{ paddingHorizontal: theme.frame }}
      contentInsetAdjustmentBehavior={tabBar ? 'automatic' : 'never'}
      // Dragging the page pulls the keyboard down with the finger (iOS); Android closes it on drag.
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            onRefresh={() => {
              // A light tap as the pull commits, on the same frame the spinner starts (apple-design: causality).
              if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              onRefresh();
            }}
            refreshing={Boolean(refreshing)}
          />
        ) : undefined
      }
      style={{ backgroundColor: theme.color.ground }}
      {...rest}
    >
      <Spacer height={top} />
      {/* Whatever is on screen as it opens shows at once; blocks that arrive later (an <Arrive>
          replacing a placeholder) fade in. */}
      <LayoutAnimationConfig skipEntering>
        <View style={{ gap: space.lg + 4 }}>
          {header ?? (title ? <PageTitle kicker={kicker} title={title} /> : null)}
          {children}
        </View>
      </LayoutAnimationConfig>
      <Spacer height={insets.bottom + (tabBar ? TAB_BAR_CLEARANCE : space.xxl)} />
    </KeyboardAwareScrollView>
  );
}

/**
 * The screen's opening: an optional mono kicker (Job Card code, date line) over a serif title and
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

/**
 * A faint Citius-blue wash that fades into the stone ground from the top of the screen. Stacked
 * bands stand in for a gradient (no gradient library is installed); at these opacities the steps
 * do not show.
 */
export function TopTint({ height = 360 }: { height?: number }) {
  const theme = useAppTheme();
  const bands = 18;
  return (
    <View importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ height, left: 0, position: 'absolute', right: 0, top: 0 }}>
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
  detail,
  icon,
  kicker,
  text,
  title,
}: {
  actions: ReactNode;
  detail?: string;
  icon: { ios: string; md: string };
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
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: theme.frame + space.xs }}
        contentInsetAdjustmentBehavior="never"
      >
        <Spacer height={insets.top + space.xxl} />
        <View style={{ flexGrow: 1, gap: space.xl, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', gap: space.lg }}>
            <View
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
            </View>
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
            {detail ? (
              <Text style={{ maxWidth: 340, textAlign: 'center' }} tone="muted" variant="secondary">
                {detail}
              </Text>
            ) : null}
          </View>
          <View style={{ gap: space.sm }}>{actions}</View>
        </View>
        <Spacer height={insets.bottom + space.xxl} />
      </ScrollView>
    </View>
  );
}

/** A 36pt square tile with an ink glyph on the inset fill: the leading mark of an expense row. */
export function IconTile({ icon, size = 36 }: { icon: { ios: string; md: string }; size?: number }) {
  const theme = useAppTheme();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        alignItems: 'center',
        backgroundColor: theme.color.inset,
        borderColor: theme.color.rule,
        borderRadius: 11,
        borderWidth: StyleSheet.hairlineWidth,
        height: size,
        justifyContent: 'center',
        width: size,
      }}
    >
      <Icon ios={icon.ios} md={icon.md} size={Math.round(size * 0.47)} />
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

/** A read-only outlined pill: trip facts in the header chip row, roles on the dark profile card. */
export function Tag({ icon, label, tone = 'light' }: { icon?: ReactNode; label: string; tone?: 'light' | 'dark' }) {
  const theme = useAppTheme();
  const dark = tone === 'dark';
  return (
    <View
      style={{
        alignItems: 'center',
        borderColor: dark ? theme.color.onDarkMuted : theme.color.border,
        borderRadius: theme.radius.chip,
        borderWidth: 1,
        flexDirection: 'row',
        flexShrink: 0,
        gap: 6,
        minHeight: 30,
        paddingHorizontal: 12,
      }}
    >
      {icon}
      <Text numberOfLines={1} tone={dark ? 'onDarkMuted' : 'ink'} variant="label">
        {label}
      </Text>
    </View>
  );
}

/** One choice in a group (audience, currency, category, batch filter). */
export function Chip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const theme = useAppTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      hitSlop={4}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
    >
      {/* The fill lives on an inner view: PressableScale owns the outer transition (the press scale),
          so the colour change gets its own 140 ms fade here instead of snapping. */}
      <Animated.View
        style={{
          alignItems: 'center',
          backgroundColor: selected ? theme.color.primary : theme.color.surface,
          borderColor: selected ? theme.color.primary : theme.color.border,
          borderRadius: theme.radius.chip,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: theme.minTarget,
          minWidth: theme.minTarget,
          paddingHorizontal: space.lg,
          transitionDuration: 140,
          transitionProperty: ['backgroundColor', 'borderColor'],
        }}
      >
        <Text variant="label" tone={selected ? 'onPrimary' : 'ink'}>
          {label}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

/**
 * A radio group of chips. With `showLabel` the group's name sits above it like a field label
 * (hidden from screen readers, which already hear it as the group's name).
 */
export function ChipRow({ children, label, showLabel }: { children: ReactNode; label: string; showLabel?: boolean }) {
  const row = (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.chipRow}>
      {children}
    </View>
  );
  if (!showLabel) return row;
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Text accessibilityElementsHidden importantForAccessibility="no" variant="label">
        {label}
      </Text>
      {row}
    </View>
  );
}

/**
 * A segmented control: a stone track with a white thumb under the chosen option. The thumb slides
 * to a new choice (220 ms ease-in-out, like iOS's own control) as one absolute view with no
 * children, so nothing else re-lays-out; the content below swaps at once. Reduced motion: it jumps.
 */
export function Segmented<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segment = trackWidth > 0 ? (trackWidth - 8) / options.length : 0;
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="tablist"
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={{ backgroundColor: theme.color.track, borderRadius: theme.radius.chip, flexDirection: 'row', padding: 4 }}
    >
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            backgroundColor: theme.color.surface,
            borderRadius: theme.radius.chip,
            // The selected tab lifts off the track, on iOS and Android alike.
            boxShadow: SELECTED_TAB_SHADOW,
            bottom: 4,
            left: 4,
            position: 'absolute',
            top: 4,
            transform: [{ translateX: index * segment }],
            transitionDuration: reduced ? 0 : 220,
            transitionProperty: 'transform',
            transitionTimingFunction: EASE_IN_OUT,
            width: segment,
          }}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            accessibilityLabel={option.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            outerStyle={{ flex: 1 }}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync().catch(() => undefined);
              onChange(option.value);
            }}
            style={{
              alignItems: 'center',
              borderRadius: theme.radius.chip,
              flex: 1,
              justifyContent: 'center',
              minHeight: 40,
            }}
          >
            <Text tone={selected ? 'ink' : 'muted'} variant="label">
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * A labelled field. `icon` sits inside the field on the left; `trailing` (a small control, such as
 * a show-password toggle) sits on the right. The border turns Citius blue while the field has focus.
 */
export function TextField({
  hint,
  icon,
  label,
  onBlur,
  onFocus,
  style,
  ref,
  trailing,
  ...rest
}: TextInputProps & {
  hint?: string;
  icon?: { ios: string; md: string };
  label: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
  trailing?: ReactNode;
}) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Text variant="label">{label}</Text>
      <Animated.View
        style={{
          alignItems: rest.multiline ? 'flex-start' : 'center',
          backgroundColor: theme.color.surface,
          borderColor: focused ? theme.color.accent : theme.color.controlBorder,
          borderRadius: theme.radius.control,
          borderWidth: 1,
          flexDirection: 'row',
          minHeight: 52,
          paddingLeft: icon ? space.md : 0,
          paddingRight: trailing ? space.xs : 0,
          transitionDuration: 160,
          transitionProperty: 'borderColor',
        }}
      >
        {icon ? <Icon color={focused ? theme.color.accent : theme.color.muted} ios={icon.ios} md={icon.md} size={18} /> : null}
        <TextInput
          ref={ref}
          accessibilityHint={hint}
          accessibilityLabel={label}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={theme.color.muted}
          style={[
            {
              color: theme.color.ink,
              flex: 1,
              ...face(theme, 'regular'),
              fontSize: 17,
              minHeight: 50,
              paddingHorizontal: icon ? space.sm + 2 : space.lg,
              paddingVertical: space.sm,
            },
            style,
          ]}
          {...rest}
        />
        {trailing}
      </Animated.View>
      {hint ? (
        <Text variant="secondary" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Initials for a name: "Aanya Testguest" -> "AT". */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts.at(-1)] : parts.slice(0, 1);
  return letters
    .map((part) => part?.[0] ?? '')
    .join('')
    .toUpperCase();
}

/** A person: an initials circle, with a check badge once they are marked. */
export function Avatar({ checked, name, size = 40, tone = 'light' }: { checked?: boolean; name: string; size?: number; tone?: 'light' | 'dark' }) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
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
      {/* Always mounted, so a row scrolling into view does not replay the pop; only a change does. */}
      <Animated.View
        style={{
          alignItems: 'center',
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
          borderRadius: 10,
          borderWidth: 1,
          height: 20,
          justifyContent: 'center',
          opacity: checked ? 1 : 0,
          position: 'absolute',
          right: -4,
          top: -4,
          transform: [{ scale: checked || reduced ? 1 : 0.5 }],
          transitionDuration: checked ? 260 : 140,
          transitionProperty: ['transform', 'opacity'],
          transitionTimingFunction: checked ? POP : 'ease-out',
          width: 20,
        }}
      >
        <Icon color={theme.color.success} ios="checkmark" md="check" size={11} />
      </Animated.View>
    </View>
  );
}

/**
 * One tick per traveller: filled Citius blue when marked here, stone when not. Reads as one
 * figure to VoiceOver ("9 of 14 marked here").
 */
export function TickStrip({ marked, total }: { marked: number; total: number }) {
  const theme = useAppTheme();
  const shown = Math.min(total, 60);
  const filled = total > shown ? Math.round((marked / total) * shown) : marked;
  // Everyone here: the strip turns green together, the one moment of colour change on the count.
  const complete = total > 0 && marked >= total;
  return (
    <View
      accessibilityLabel={`${marked} of ${total} marked here`}
      accessible
      style={{ flexDirection: 'row', gap: shown > 30 ? 2 : 5, height: 24 }}
    >
      {Array.from({ length: shown }, (_, index) => (
        // A Reanimated view runs the colour change as a CSS transition on the UI thread.
        <Animated.View
          key={index}
          style={{
            backgroundColor: index < filled ? (complete ? theme.color.success : theme.color.accent) : theme.color.tickOff,
            borderRadius: 2,
            flex: 1,
            transitionDelay: complete ? index * 12 : 0,
            transitionDuration: 160,
            transitionProperty: 'backgroundColor',
          }}
        />
      ))}
    </View>
  );
}

export interface TrayAction {
  icon: { ios: string; md: string };
  label: string;
  onPress: () => void;
}

/** The dark action tray: up to four shortcuts, icon over label. */
export function ActionTray({ actions }: { actions: TrayAction[] }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        backgroundColor: theme.color.dark,
        borderRadius: theme.radius.surface + 2,
        flexDirection: 'row',
        gap: 6,
        padding: 6,
      }}
    >
      {actions.map((action) => (
        <PressableScale
          accessibilityLabel={action.label}
          accessibilityRole="button"
          key={action.label}
          onPress={action.onPress}
          outerStyle={{ flex: 1 }}
          style={{
            alignItems: 'center',
            backgroundColor: '#1a2035',
            borderRadius: theme.radius.inset,
            flex: 1,
            gap: 6,
            justifyContent: 'center',
            minHeight: 68,
            paddingHorizontal: 4,
          }}
        >
          <Icon color={theme.color.onDark} ios={action.icon.ios} md={action.icon.md} size={20} />
          <Text numberOfLines={1} tone="onDark" variant="label">
            {action.label}
          </Text>
        </PressableScale>
      ))}
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
  accessibilityLabel,
  chevron,
  detail,
  last,
  leading,
  onPress,
  subtitle,
  subtitleLines = 2,
  title,
  trailing,
}: {
  accessibilityLabel?: string;
  chevron?: boolean;
  /** Shown under the subtitle, inside the text column (a status pill, say). */
  detail?: ReactNode;
  /** The last row in a card draws no rule under it. */
  last?: boolean;
  leading?: ReactNode;
  onPress?: () => void;
  subtitle?: string;
  /** Lines before the subtitle truncates; 0 shows it all (settings explanations). */
  subtitleLines?: number;
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
        <Text numberOfLines={subtitleLines || undefined} variant="secondary" tone="muted">
          {subtitle}
        </Text>
      ) : null}
      {detail ? <View style={styles.rowDetail}>{detail}</View> : null}
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
          accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
          style={styles.rowText}
        >
          {text}
        </View>
        {end}
      </View>
    );
  }
  return (
    <PressableScale accessibilityLabel={accessibilityLabel ?? title} accessibilityRole="button" onPress={onPress}>
      <View style={rowStyle}>
        {leading}
        <View style={styles.rowText}>{text}</View>
        {end}
      </View>
    </PressableScale>
  );
}

/** A round 44pt call button with a phone glyph. */
export function CallButton({ name, phone }: { name: string; phone: string }) {
  const theme = useAppTheme();
  return (
    <PressableScale
      accessibilityHint="Opens the phone app"
      accessibilityLabel={`Call ${name}`}
      accessibilityRole="button"
      hitSlop={4}
      onPress={() => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => undefined)}
      style={{
        alignItems: 'center',
        backgroundColor: theme.color.surface,
        borderColor: theme.color.border,
        borderRadius: 22,
        borderWidth: 1,
        height: 44,
        justifyContent: 'center',
        width: 44,
      }}
    >
      <Icon ios="phone.fill" md="call" size={17} />
    </PressableScale>
  );
}

/** A small pill-shaped action with a label, sized for a thumb, for a row's trailing slot. */
export function ActionPill({
  accessibilityLabel,
  icon,
  label,
  onPress,
}: {
  accessibilityLabel?: string;
  icon: { ios: string; md: string };
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: theme.color.surface,
        borderColor: theme.color.border,
        borderRadius: theme.radius.chip,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        minHeight: theme.minTarget,
        paddingHorizontal: space.md,
      }}
    >
      <Icon ios={icon.ios} md={icon.md} size={15} />
      <Text variant="label">{label}</Text>
    </PressableScale>
  );
}

/** One quiet sentence with one mark: an empty or all-clear state inside its block. */
export function QuietState({ good, text }: { good?: boolean; text: string }) {
  const theme = useAppTheme();
  return (
    <View accessible accessibilityLabel={text} style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: good ? theme.color.successSoft : theme.color.inset,
          borderRadius: 18,
          height: 36,
          justifyContent: 'center',
          width: 36,
        }}
      >
        <Icon color={good ? theme.color.success : theme.color.muted} ios={good ? 'checkmark' : 'minus'} md={good ? 'check' : 'remove'} size={15} />
      </View>
      <Text style={{ maxWidth: 280, textAlign: 'center' }} tone="muted" variant="secondary">
        {text}
      </Text>
    </View>
  );
}

/** Static bars at real size while something loads; no shimmer. */
export function Placeholder({ lines = 3 }: { lines?: number }) {
  const theme = useAppTheme();
  return (
    <View accessibilityLabel="Loading" accessible style={{ gap: space.sm + 2 }}>
      {Array.from({ length: lines }, (_, index) => (
        <View
          key={index}
          style={{ backgroundColor: theme.color.tickOff, borderRadius: 6, height: 18, opacity: 0.6, width: index === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
  },
  rowDetail: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.xs },
  rowText: { flex: 1, gap: 2 },
  sectionTitle: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
});

/**
 * A big count that rolls to its new value, like iOS's numeric text: up when it grows, down when it
 * shrinks (160 ms). Opening the screen shows it still (skipEntering), so motion only answers a tap.
 */
export function StepNumber({ value }: { value: string }) {
  // The direction of a change is decided against the value shown before it (adjusted in render).
  const [shown, setShown] = useState(value);
  const [rising, setRising] = useState(true);
  if (shown !== value) {
    setRising(rollsUp(shown, value));
    setShown(value);
  }
  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.View entering={rising ? ROLL_UP : ROLL_DOWN} key={value}>
        <Text tabular variant="answer">
          {value}
        </Text>
      </Animated.View>
    </LayoutAnimationConfig>
  );
}

/**
 * The everyone-here seal beside "All": a green check that pops in when the last traveller is marked
 * (320 ms with a small overshoot, the delight moment of a stop). Opening a screen where everyone is
 * already marked shows it still, so it only ever celebrates the tap that completed the count.
 */
export function EveryoneSeal({ shown }: { shown: boolean }) {
  const theme = useAppTheme();
  return (
    <LayoutAnimationConfig skipEntering>
      {shown ? (
        <Animated.View
          entering={SEAL_IN}
          importantForAccessibility="no-hide-descendants"
          style={{
            alignItems: 'center',
            alignSelf: 'center',
            backgroundColor: theme.color.successSoft,
            borderRadius: 16,
            height: 32,
            justifyContent: 'center',
            width: 32,
          }}
        >
          <Icon color={theme.color.success} ios="checkmark" md="check" size={16} />
        </Animated.View>
      ) : null}
    </LayoutAnimationConfig>
  );
}

/**
 * Wraps content that replaces a placeholder inside a `Screen`: it fades in (220 ms ease-out) when it
 * arrives after loading, and shows at once when it was already there as the screen opened.
 */
export function Arrive({ children, gap }: { children: ReactNode; gap?: number }) {
  return (
    <Animated.View entering={ARRIVE} style={gap === undefined ? undefined : { gap }}>
      {children}
    </Animated.View>
  );
}
