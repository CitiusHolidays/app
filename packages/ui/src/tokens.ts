import { Platform } from "react-native";

/**
 * Shared craft layer: spacing, motion, haptic moments, type roles and the accessibility floor.
 * Palettes, radii and density are per app: the staff palette lives in
 * `staffTheme`; the customer app adds its own theme later without touching these.
 */

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Motion is feedback, not performance. Values are in milliseconds. */
export const motion = {
  contentInsert: 200,
  easeOut: [0.23, 1, 0.32, 1] as const,
  pressIn: 120,
  pressRelease: 160,
  pressScale: 0.97,
  stateChange: 160,
} as const;

export interface AppTheme {
  name: string;
  color: {
    /** Citius blue: data and the one active state (filled ticks, selected segment, links). */
    accent: string;
    border: string;
    /** Resting card fill, one step lighter than the ground. */
    card: string;
    controlBorder: string;
    danger: string;
    dangerSoft: string;
    /** Floating dark layer: the action tray and the profile card. */
    dark: string;
    ground: string;
    ink: string;
    /** Inset panel inside a card. */
    inset: string;
    muted: string;
    onDark: string;
    onDarkMuted: string;
    onPrimary: string;
    /** Dashed ring for pending states (non-text, 3:1). */
    pending: string;
    /** Primary action fill: near-black. */
    primary: string;
    /** Row rules inside a card, one step lighter than card edges. */
    rule: string;
    /** Segmented-control track. */
    track: string;
    success: string;
    successSoft: string;
    surface: string;
    /** Unmarked headcount tick. */
    tickOff: string;
    warning: string;
    warningSoft: string;
  };
  font: { display: string; mono: string; regular: string; medium: string; semibold: string };
  radius: { chip: number; control: number; hero: number; inset: number; surface: number };
  /** Minimum touch target in points (staff 44, customer 48). */
  minTarget: number;
  /** Side margin of the phone frame. */
  frame: number;
  type: TypeScale;
}

export interface TypeRole {
  fontFamily?: keyof AppTheme["font"];
  fontSize: number;
  fontWeight: "400" | "500" | "600";
  letterSpacing?: number;
  lineHeight: number;
  /** Only display figures are capped; everything else scales with Dynamic Type. */
  maxFontSizeMultiplier?: number;
  uppercase?: boolean;
}

export interface TypeScale {
  answer: TypeRole;
  body: TypeRole;
  bodyStrong: TypeRole;
  display: TypeRole;
  label: TypeRole;
  meta: TypeRole;
  mono: TypeRole;
  rowTitle: TypeRole;
  secondary: TypeRole;
  section: TypeRole;
  title: TypeRole;
}

/**
 * Citius Connect in the Citius palette (website `src/app/globals.css`): Citius blue for primary
 * actions and data, night for the dark tray and profile card, public ink and muted for text,
 * paper and brand-border for grounds and lines, and the account-shell success and gold mixes for
 * status. The ground is paper mixed half with brand-border so white cards read on it.
 * Every text pair is at least 4.5:1 (muted on ground 5.3:1, on white 6.0:1).
 * Type: see `platformFonts`.
 */
export const citius = {
  blue: "#102a83",
  border: "#e2e8f0",
  green: "#8dc63f",
  ink: "#0f172a",
  light: "#f8fafc",
  lime: "#b5d439",
  muted: "#55647b",
  mutedOnDark: "#cbd5e1",
  night: "#0b1026",
  orange: "#f58220",
  orangeInk: "#8a3500",
  paper: "#fdfbf7",
} as const;

/**
 * Type faces. On iOS the app uses Apple's own system faces, which ship with the OS and need no
 * bundling: SF Pro for the interface, New York for titles, SF Mono for codes. Apple's downloadable
 * copies are licensed for mockups only, so nothing of Apple's is bundled. Android uses bundled OFL
 * faces with the same roles: Inter, Instrument Serif and JetBrains Mono.
 */
export const platformFonts: AppTheme["font"] =
  Platform.OS === "ios"
    ? { display: "ui-serif", medium: "System", mono: "ui-monospace", regular: "System", semibold: "System" }
    : {
        display: "InstrumentSerif_400Regular",
        medium: "Inter_500Medium",
        mono: "JetBrainsMono_500Medium",
        regular: "Inter_400Regular",
        semibold: "Inter_600SemiBold",
      };

/** The weight each face role stands for; system faces need it, bundled faces carry it. */
export const faceWeights: Record<keyof AppTheme["font"], "400" | "500" | "600"> = {
  display: "400",
  medium: "500",
  mono: "500",
  regular: "400",
  semibold: "600",
};

export const staffTheme: AppTheme = {
  color: {
    accent: citius.blue,
    border: citius.border,
    card: "#ffffff",
    controlBorder: "#8a94a6",
    /** No Citius red exists yet; a proposed negative token pending brand approval. */
    danger: "#9a2a1f",
    dangerSoft: "#fbe3de",
    dark: citius.night,
    ground: "#f0f2f4",
    ink: citius.ink,
    inset: citius.light,
    muted: citius.muted,
    onDark: "#ffffff",
    onDarkMuted: citius.mutedOnDark,
    onPrimary: "#ffffff",
    pending: "#8a94a6",
    primary: citius.blue,
    rule: "#edf0f4",
    /** account-shell success: green 55% into ink, on green 16% into white. */
    success: "#4e7242",
    successSoft: "#ecf6e3",
    surface: "#ffffff",
    tickOff: "#ccd1d9",
    track: citius.border,
    /** account-shell gold: orange-ink on orange 14% into white. */
    warning: citius.orangeInk,
    warningSoft: "#ffeee4",
  },
  font: platformFonts,
  frame: 20,
  minTarget: 44,
  name: "citius-connect",
  radius: { chip: 999, control: 14, hero: 24, inset: 16, surface: 20 },
  type: {
    answer: { fontFamily: "semibold", fontSize: 44, fontWeight: "600", letterSpacing: -1, lineHeight: 48, maxFontSizeMultiplier: 1.5 },
    body: { fontFamily: "regular", fontSize: 16, fontWeight: "400", lineHeight: 22 },
    bodyStrong: { fontFamily: "semibold", fontSize: 16, fontWeight: "600", lineHeight: 22 },
    display: { fontFamily: "display", fontSize: 34, fontWeight: "400", letterSpacing: -0.5, lineHeight: 38, maxFontSizeMultiplier: 1.6 },
    label: { fontFamily: "medium", fontSize: 13, fontWeight: "500", lineHeight: 16 },
    meta: { fontFamily: "medium", fontSize: 13, fontWeight: "500", lineHeight: 18 },
    mono: { fontFamily: "mono", fontSize: 12, fontWeight: "500", letterSpacing: 0.6, lineHeight: 16, uppercase: true },
    rowTitle: { fontFamily: "semibold", fontSize: 17, fontWeight: "600", lineHeight: 22 },
    secondary: { fontFamily: "regular", fontSize: 15, fontWeight: "400", lineHeight: 20 },
    section: { fontFamily: "semibold", fontSize: 20, fontWeight: "600", lineHeight: 24 },
    title: { fontFamily: "display", fontSize: 34, fontWeight: "400", letterSpacing: -0.5, lineHeight: 38 },
  },
};
