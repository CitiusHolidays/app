import { face, PressableScale, space, Surface, Text, useAppTheme } from '@citius/ui';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps, ReactNode } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pop, Rise } from '@/components/motion-views';
import { initials } from '@/lib/initials';
import { useRevealEndOnKeyboard } from '@/lib/use-reveal-end-on-keyboard';

/** Room under the content for the floating tab bar. */
const TAB_BAR_CLEARANCE = 96;

/**
 * A scrolling screen on the stone ground. A titled screen opens with an optional mono kicker
 * (date line, Job Card code) over a serif title; `header` replaces both for custom openings.
 */
export function Screen({
  children,
  form = false,
  header,
  kicker,
  onRefresh,
  refreshing,
  tabBar = true,
  title,
  ...rest
}: ScrollViewProps & {
  children: ReactNode;
  /** A screen with a text field: it stays above the keyboard, with its last button in sight. */
  form?: boolean;
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
      refreshControl={onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={Boolean(refreshing)} /> : undefined}
      style={{ backgroundColor: theme.color.ground }}
      {...(form ? reveal : null)}
      {...rest}
    >
      {header ?? (title ? <PageTitle kicker={kicker} title={title} /> : null)}
      {children}
    </ScrollView>
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
          {/* Occasional screens (a refusal, an error, a finished deletion): the mark pops, then the
              words and the way out rise in, so the change of screen reads as one beat. */}
          <Pop
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
          </Pop>
          <Rise index={1}>
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
          </Rise>
          <Rise index={2}>
          <Text style={{ maxWidth: 340, textAlign: 'center' }}>{text}</Text>
          </Rise>
          {detail ? (
            <Text style={{ maxWidth: 340, textAlign: 'center' }} tone="muted" variant="secondary">
              {detail}
            </Text>
          ) : null}
        </View>
        <Rise index={3} style={{ gap: space.sm }}>
          {actions}
        </Rise>
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
      }}
    >
      <Text variant="label" tone={selected ? 'onPrimary' : 'ink'}>
        {label}
      </Text>
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

/** A segmented control: a stone track with a white thumb under the chosen option. */
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
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="tablist"
      style={{ backgroundColor: theme.color.track, borderRadius: theme.radius.chip, flexDirection: 'row', padding: 4 }}
    >
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
              backgroundColor: selected ? theme.color.surface : 'transparent',
              borderRadius: theme.radius.chip,
              flex: 1,
              justifyContent: 'center',
              boxShadow: selected ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
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

export function TextField({ hint, label, style, ...rest }: TextInputProps & { hint?: string; label: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityHint={hint}
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
      {hint ? (
        <Text variant="secondary" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** A person: an initials circle, with a check badge once they are marked. */
export function Avatar({ checked, name, size = 40, tone = 'light' }: { checked?: boolean; name: string; size?: number; tone?: 'light' | 'dark' }) {
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
      {checked ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.color.surface,
            borderColor: theme.color.border,
            borderRadius: 10,
            borderWidth: 1,
            height: 20,
            justifyContent: 'center',
            position: 'absolute',
            right: -4,
            top: -4,
            width: 20,
          }}
        >
          <Icon color={theme.color.success} ios="checkmark" md="check" size={11} />
        </View>
      ) : null}
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
export function CallButton({ label, phone }: { label: string; phone: string }) {
  const theme = useAppTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={4}
      onPress={() => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => undefined)}
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
      <Pop
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
      </Pop>
      <Text style={{ maxWidth: 280, textAlign: 'center' }} tone="muted" variant="secondary">
        {text}
      </Text>
    </View>
  );
}

/** Static bars at real size while something loads; no shimmer. */
export function Placeholder({ label, lines = 3 }: { label: string; lines?: number }) {
  const theme = useAppTheme();
  return (
    <View accessibilityLabel={label} accessible style={{ gap: space.sm + 2 }}>
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
