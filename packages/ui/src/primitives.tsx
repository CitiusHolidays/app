import { createContext, type ReactNode, useContext, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
  View,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import Animated, { cubicBezier, useReducedMotion } from "react-native-reanimated";

import { type AppTheme, citius, faceWeights, motion, space, type TypeScale } from "./tokens";

/**
 * The style for one face role. iOS system faces take their weight from `fontWeight`; bundled
 * Android faces carry their own weight, and setting one there would fall back to Roboto.
 */
export function face(theme: AppTheme, role: keyof AppTheme["font"]) {
  return Platform.OS === "ios"
    ? { fontFamily: theme.font[role], fontWeight: faceWeights[role] }
    : { fontFamily: theme.font[role] };
}

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

type Tone = "ink" | "muted" | "accent" | "primary" | "success" | "warning" | "danger" | "onPrimary" | "onDark" | "onDarkMuted";

export interface TextProps extends RNTextProps {
  variant?: keyof TypeScale;
  tabular?: boolean;
  tone?: Tone;
}

/**
 * Text with a type role. Bundled faces carry their own weight, so a role with a font family sets
 * the family and leaves the weight alone (Android would otherwise fall back to the system face).
 * Dynamic Type stays on; only display figures are capped.
 */
export function Text({ children, style, tabular, tone = "ink", variant = "body", ...rest }: TextProps) {
  const theme = useAppTheme();
  const scale = theme.type[variant];
  return (
    <RNText
      maxFontSizeMultiplier={scale.maxFontSizeMultiplier}
      style={[
        {
          color: theme.color[tone],
          fontSize: scale.fontSize,
          letterSpacing: scale.letterSpacing,
          lineHeight: scale.lineHeight,
          textTransform: scale.uppercase ? "uppercase" : undefined,
        },
        scale.fontFamily ? face(theme, scale.fontFamily) : { fontWeight: scale.fontWeight },
        tabular ? styles.tabular : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export interface SurfaceProps extends ViewProps {
  /** card: the resting card. hero: the screen's answer block. inset: a panel inside a card. */
  variant?: "card" | "hero" | "inset";
}

/** Flat surfaces: a fill one step off the ground and a hairline, never a shadow. */
export function Surface({ style, variant = "card", ...rest }: SurfaceProps) {
  const theme = useAppTheme();
  const look = {
    card: { backgroundColor: theme.color.card, borderRadius: theme.radius.surface, padding: space.lg },
    hero: { backgroundColor: theme.color.card, borderRadius: theme.radius.hero, padding: space.xl - 4 },
    inset: { backgroundColor: theme.color.inset, borderRadius: theme.radius.inset, padding: space.md },
  }[variant];
  return (
    <View
      style={[
        { borderColor: variant === "inset" ? theme.color.rule : theme.color.border, borderWidth: StyleSheet.hairlineWidth },
        look,
        style,
      ]}
      {...rest}
    />
  );
}

const pressEase = cubicBezier(...motion.easeOut);

export interface PressableScaleProps extends PressableProps {
  children: ReactNode;
  /** Layout for the touch area itself (flex, width), for items laid out in a row. */
  outerStyle?: StyleProp<ViewStyle>;
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
  outerStyle,
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
      style={outerStyle}
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
  icon?: ReactNode;
  label: string;
  variant?: "primary" | "secondary";
}

/** Pill buttons in pairs: near-black primary, white secondary with a hairline. */
export function Button({ busy, disabled, icon, label, variant = "primary", ...rest }: ButtonProps) {
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
        borderColor: primary ? theme.color.primary : theme.color.border,
        borderRadius: theme.radius.chip,
        borderWidth: 1,
        flexDirection: "row",
        gap: space.sm,
        justifyContent: "center",
        minHeight: 48,
        paddingHorizontal: space.lg + 4,
        paddingVertical: space.sm,
      }}
      {...rest}
    >
      {busy ? <ActivityIndicator color={primary ? theme.color.onPrimary : theme.color.ink} /> : icon}
      <Text variant="bodyStrong" tone={primary ? "onPrimary" : "ink"}>
        {label}
      </Text>
    </PressableScale>
  );
}

export type StatusKind = "good" | "attention" | "danger" | "neutral" | "live";

/**
 * A pale pill with ink of the same hue and a shape marker, so the state reads without colour:
 * check for done, exclamation for attention, a dashed ring for pending, a dot for live.
 */
export function StatusPill({ kind, label }: { kind: StatusKind; label: string }) {
  const theme = useAppTheme();
  const look = {
    attention: { bg: theme.color.warningSoft, fg: "warning" as const, mark: "!" },
    danger: { bg: theme.color.dangerSoft, fg: "danger" as const, mark: "!" },
    good: { bg: theme.color.successSoft, fg: "success" as const, mark: "✓" },
    live: { bg: "transparent", fg: "ink" as const, mark: "dot" },
    neutral: { bg: "transparent", fg: "muted" as const, mark: "ring" },
  }[kind];
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: look.bg,
        borderColor: kind === "live" || kind === "neutral" ? theme.color.border : "transparent",
        borderRadius: theme.radius.chip,
        // A live pill sits among the trip's outlined chips, so it takes their outline and size.
        borderWidth: kind === "live" ? 1 : StyleSheet.hairlineWidth,
        flexDirection: "row",
        flexShrink: 0,
        gap: 6,
        minHeight: kind === "live" ? 30 : 26,
        paddingHorizontal: kind === "live" ? 12 : 10,
      }}
    >
      {look.mark === "dot" ? (
        <View style={{ backgroundColor: citius.green, borderRadius: 4, height: 7, width: 7 }} />
      ) : look.mark === "ring" ? (
        <View
          style={{ borderColor: theme.color.pending, borderRadius: 6, borderStyle: "dashed", borderWidth: 1.2, height: 11, width: 11 }}
        />
      ) : (
        <Text importantForAccessibility="no" variant="label" tone={look.fg}>
          {look.mark}
        </Text>
      )}
      <Text numberOfLines={1} variant="label" tone={look.fg}>
        {label}
      </Text>
    </View>
  );
}

export function Banner({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusKind }) {
  const theme = useAppTheme();
  const background =
    tone === "attention"
      ? theme.color.warningSoft
      : tone === "good"
        ? theme.color.successSoft
        : tone === "danger"
          ? theme.color.dangerSoft
          : theme.color.card;
  return (
    <View
      accessibilityRole="summary"
      style={{
        backgroundColor: background,
        borderColor: tone === "neutral" ? theme.color.border : "transparent",
        borderRadius: theme.radius.inset,
        borderWidth: StyleSheet.hairlineWidth,
        gap: space.xs,
        padding: space.md + 2,
      }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ["tabular-nums"] },
});
