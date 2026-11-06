/**
 * Shared craft layer: spacing, motion, haptic moments, type roles and the accessibility floor.
 * Palettes, radii and density are per app (FRONTEND-HANDOFF D11): the staff palette lives in
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

/** Motion stance D9: feedback, not performance. Values are in milliseconds. */
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
    border: string;
    controlBorder: string;
    ground: string;
    ink: string;
    muted: string;
    onPrimary: string;
    primary: string;
    success: string;
    successSoft: string;
    surface: string;
    warning: string;
    warningSoft: string;
  };
  radius: { control: number; surface: number };
  /** Minimum touch target in points (staff 44, customer 48; D10). */
  minTarget: number;
  /** Side margin of the phone frame. */
  frame: number;
  type: TypeScale;
}

export interface TypeRole {
  fontSize: number;
  fontWeight: "400" | "500" | "600";
  lineHeight: number;
  /** Only the answer figure is capped; everything else scales with Dynamic Type. */
  maxFontSizeMultiplier?: number;
}

export interface TypeScale {
  answer: TypeRole;
  body: TypeRole;
  bodyStrong: TypeRole;
  meta: TypeRole;
  secondary: TypeRole;
  section: TypeRole;
  title: TypeRole;
}

/**
 * Citius Connect, from the portal's `.portal-shell` tokens (warm neutrals, Citius blue only on the
 * primary action). Success and warning ink are the portal's oklch tokens converted to sRGB.
 * System fonts until product approves bundling Inter (DESIGN.md: font changes need approval).
 */
export const staffTheme: AppTheme = {
  color: {
    border: "#e7e7e9",
    controlBorder: "#686b72",
    ground: "#fafafa",
    ink: "#24272d",
    muted: "#686b72",
    onPrimary: "#ffffff",
    primary: "#102a83",
    success: "#39745b",
    successSoft: "#e9f3ee",
    surface: "#ffffff",
    warning: "#7d5628",
    warningSoft: "#f6efe6",
  },
  frame: 16,
  minTarget: 44,
  name: "citius-connect",
  radius: { control: 8, surface: 12 },
  type: {
    answer: { fontSize: 28, fontWeight: "600", lineHeight: 34, maxFontSizeMultiplier: 1.5 },
    body: { fontSize: 16, fontWeight: "400", lineHeight: 22 },
    bodyStrong: { fontSize: 16, fontWeight: "600", lineHeight: 22 },
    meta: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
    secondary: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
    section: { fontSize: 17, fontWeight: "600", lineHeight: 22 },
    title: { fontSize: 22, fontWeight: "600", lineHeight: 28 },
  },
};
