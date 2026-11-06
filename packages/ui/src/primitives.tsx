import { createContext, type ReactNode, useContext, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
  View,
  type ViewProps,
} from "react-native";
import Animated, { cubicBezier, useReducedMotion } from "react-native-reanimated";

import { type AppTheme, motion, space, type TypeScale } from "./tokens";

const ThemeContext = createContext<AppTheme | null>(null);

export function ThemeProvider({ children, theme }: { children: ReactNode; theme: AppTheme }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useAppTheme needs a ThemeProvider");
  }
  return theme;
}

type Tone = "ink" | "muted" | "primary" | "success" | "warning" | "onPrimary";

export interface TextProps extends RNTextProps {
  variant?: keyof TypeScale;
  tabular?: boolean;
  tone?: Tone;
}

/** Text with a type role. Dynamic Type stays on; only the answer role is capped. */
export function Text({ style, tabular, tone = "ink", variant = "body", ...rest }: TextProps) {
  const theme = useAppTheme();
  const scale = theme.type[variant];
  return (
    <RNText
      maxFontSizeMultiplier={scale.maxFontSizeMultiplier}
      style={[
        {
          color: theme.color[tone],
          fontSize: scale.fontSize,
          fontWeight: scale.fontWeight,
          lineHeight: scale.lineHeight,
        },
        tabular ? styles.tabular : null,
        style,
      ]}
      {...rest}
    />
  );
}

export function Surface({ style, ...rest }: ViewProps) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
          borderRadius: theme.radius.surface,
          borderWidth: StyleSheet.hairlineWidth,
          padding: space.lg,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const pressEase = cubicBezier(...motion.easeOut);

export interface PressableScaleProps extends PressableProps {
  children: ReactNode;
}

/**
 * Press feedback: scale 0.97 in 120ms on press-in, 160ms back. Reduced motion keeps an opacity
 * change and drops the scale. Runs as a Reanimated CSS transition on the UI thread.
 */
export function PressableScale({
  children,
  disabled,
  onPressIn,
  onPressOut,
  style,
  ...rest
}: PressableScaleProps) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  return (
    <Pressable
      disabled={disabled}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      pressRetentionOffset={12}
      {...rest}
    >
      {(state) => (
        <Animated.View
          style={[
            typeof style === "function" ? style(state) : style,
            {
              opacity: disabled ? 0.5 : reduced && pressed ? 0.7 : 1,
              transform: [{ scale: !reduced && pressed ? motion.pressScale : 1 }],
              transitionDuration: pressed ? motion.pressIn : motion.pressRelease,
              transitionProperty: ["transform", "opacity"],
              transitionTimingFunction: pressEase,
            },
          ]}
        >
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}

export interface ButtonProps extends Omit<PressableProps, "children"> {
  busy?: boolean;
  label: string;
  variant?: "primary" | "secondary";
}

export function Button({ busy, disabled, label, variant = "primary", ...rest }: ButtonProps) {
  const theme = useAppTheme();
  const primary = variant === "primary";
  return (
    <PressableScale
      accessibilityLabel={rest.accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(busy), disabled: Boolean(disabled || busy) }}
      disabled={disabled || busy}
      style={{
        alignItems: "center",
        backgroundColor: primary ? theme.color.primary : theme.color.surface,
        borderColor: primary ? theme.color.primary : theme.color.controlBorder,
        borderRadius: theme.radius.control,
        borderWidth: 1,
        flexDirection: "row",
        gap: space.sm,
        justifyContent: "center",
        minHeight: theme.minTarget,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
      }}
      {...rest}
    >
      {busy ? <ActivityIndicator color={primary ? theme.color.onPrimary : theme.color.primary} /> : null}
      <Text variant="bodyStrong" tone={primary ? "onPrimary" : "primary"}>
        {label}
      </Text>
    </PressableScale>
  );
}

export type StatusKind = "good" | "attention" | "neutral";

/** Status always carries words and a shape marker; colour is never the only signal. */
export function StatusPill({ kind, label }: { kind: StatusKind; label: string }) {
  const theme = useAppTheme();
  const palette = {
    attention: { bg: theme.color.warningSoft, fg: "warning" as const, mark: "!" },
    good: { bg: theme.color.successSoft, fg: "success" as const, mark: "✓" },
    neutral: { bg: theme.color.ground, fg: "muted" as const, mark: "•" },
  }[kind];
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        alignSelf: "flex-start",
        backgroundColor: palette.bg,
        borderColor: theme.color.border,
        borderRadius: theme.radius.control,
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        gap: space.xs,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
      }}
    >
      <Text importantForAccessibility="no" variant="meta" tone={palette.fg}>
        {palette.mark}
      </Text>
      <Text variant="meta" tone={palette.fg}>
        {label}
      </Text>
    </View>
  );
}

export function Banner({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusKind }) {
  const theme = useAppTheme();
  const background =
    tone === "attention" ? theme.color.warningSoft : tone === "good" ? theme.color.successSoft : theme.color.surface;
  return (
    <View
      accessibilityRole="summary"
      style={{
        backgroundColor: background,
        borderColor: theme.color.border,
        borderRadius: theme.radius.surface,
        borderWidth: StyleSheet.hairlineWidth,
        gap: space.xs,
        padding: space.md,
      }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ["tabular-nums"] },
});
