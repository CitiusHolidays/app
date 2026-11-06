import { PressableScale, space, Text, useAppTheme } from '@citius/ui';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
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

/** A scrolling screen on the staff ground with the 16pt frame and safe-area top. */
export function Screen({
  children,
  onRefresh,
  refreshing,
  title,
  ...rest
}: ScrollViewProps & { children: ReactNode; onRefresh?: () => void; refreshing?: boolean; title?: string }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={{
        gap: space.lg,
        paddingBottom: insets.bottom + space.xxl,
        paddingHorizontal: theme.frame,
        paddingTop: title ? insets.top + space.lg : space.lg,
      }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={Boolean(refreshing)} /> : undefined}
      style={{ backgroundColor: theme.color.ground }}
      {...rest}
    >
      {title ? (
        <Text accessibilityRole="header" variant="title">
          {title}
        </Text>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" variant="section">
      {children}
    </Text>
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
        borderColor: selected ? theme.color.primary : theme.color.controlBorder,
        borderRadius: theme.radius.control,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: theme.minTarget,
        minWidth: theme.minTarget,
        paddingHorizontal: space.md,
      }}
    >
      <Text variant="bodyStrong" tone={selected ? 'onPrimary' : 'ink'}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function ChipRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.chipRow}>
      {children}
    </View>
  );
}

export function TextField({ hint, label, style, ...rest }: TextInputProps & { hint?: string; label: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="bodyStrong">{label}</Text>
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
            fontSize: theme.type.body.fontSize,
            minHeight: theme.minTarget,
            paddingHorizontal: space.md,
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

/**
 * A row with a title, a subline and an optional trailing element. With `onPress` the whole row is
 * one button. Without it, the text is one accessibility element and the trailing element (a Call
 * button, say) stays separately reachable: an `accessible` wrapper would hide it from VoiceOver.
 */
export function Row({
  accessibilityLabel,
  onPress,
  subtitle,
  title,
  trailing,
}: {
  accessibilityLabel?: string;
  onPress?: () => void;
  subtitle?: string;
  title: string;
  trailing?: ReactNode;
}) {
  const theme = useAppTheme();
  const text = (
    <>
      <Text variant="bodyStrong">{title}</Text>
      {subtitle ? (
        <Text variant="secondary" tone="muted">
          {subtitle}
        </Text>
      ) : null}
    </>
  );
  const rowStyle = [styles.row, { borderBottomColor: theme.color.border, minHeight: theme.minTarget }];
  if (!onPress) {
    return (
      <View style={rowStyle}>
        <View
          accessible
          accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
          style={styles.rowText}
        >
          {text}
        </View>
        {trailing}
      </View>
    );
  }
  return (
    <PressableScale accessibilityLabel={accessibilityLabel ?? title} accessibilityRole="button" onPress={onPress}>
      <View style={rowStyle}>
        <View style={styles.rowText}>{text}</View>
        {trailing}
      </View>
    </PressableScale>
  );
}

export function CallButton({ name, phone }: { name: string; phone: string }) {
  const theme = useAppTheme();
  return (
    <PressableScale
      accessibilityHint="Opens the phone app"
      accessibilityLabel={`Call ${name}`}
      accessibilityRole="button"
      onPress={() => void Linking.openURL(`tel:${phone}`).catch(() => undefined)}
      style={{
        alignItems: 'center',
        borderColor: theme.color.controlBorder,
        borderRadius: theme.radius.control,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: theme.minTarget,
        minWidth: theme.minTarget,
        paddingHorizontal: space.md,
      }}
    >
      <Text variant="bodyStrong" tone="primary">
        Call
      </Text>
    </PressableScale>
  );
}

/** Static grey bars at real size while something loads; no shimmer. */
export function Placeholder({ lines = 3 }: { lines?: number }) {
  const theme = useAppTheme();
  return (
    <View accessibilityLabel="Loading" accessible style={{ gap: space.sm }}>
      {Array.from({ length: lines }, (_, index) => (
        <View
          key={index}
          style={{ backgroundColor: theme.color.border, borderRadius: 4, height: 18, width: index === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </View>
  );
}

export function haptic(kind: 'success' | 'error') {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(
    kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
  ).catch(() => undefined);
}

export function formatDateRange(start: string, end: string) {
  const format = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return '';
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(
      new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    );
  };
  const from = format(start);
  const to = format(end);
  if (!from) return 'Dates not set';
  return to && to !== from ? `${from} – ${to}` : from;
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.sm,
  },
  rowText: { flex: 1, gap: 2 },
});
