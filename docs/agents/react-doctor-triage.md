# React Doctor triage record

React Doctor `0.9.22`. The standard is a configured scan at 100/100 with zero diagnostics. Real
findings are fixed; an exception names an exact file and rule, with the reason it was checked.
React Doctor output is a hypothesis, not proof: each finding below was read in its code.

## apps/customer

Confirmed with `bunx react-doctor --score --yes --project apps/customer`: **100**, no issues
(7 Nov 2026). The first scan of app main `a90a3af` reported 24 issues (3 errors, 21 warnings).

### Fixed

- `react-hooks-js/todo` (3): React Compiler cannot compile a `finally` inside a component
  (`delete-account.tsx`, `trip/[id]/index.tsx`, `features/session/session.tsx`). The cleanup now
  runs through `lib/run-then.ts` (`runThen(task, cleanup)`), a module function with the `finally`,
  so it still runs on success and on failure and the error still reaches the caller.
- `react-doctor/no-loading-flag-reset-outside-finally` (2): `delete-account.tsx` (send link) and
  `invite.tsx` (accept) cleared their busy flag on one path only; both use `runThen` now.
- `react-doctor/js-hoist-intl` (1): the Journeys date kicker builds its formatter once per language
  (`i18n/format.ts`, `formatLongDate`).
- `react-doctor/rn-no-legacy-shadow-styles`, `rn-style-prefer-boxshadow` (1 each): the segmented
  control's selected shadow is a `boxShadow` (React Native 0.88).
- `react-doctor/only-export-components` (7): non-component exports moved out of component files
  so Fast Refresh keeps state: `lib/haptic.ts`, `lib/initials.ts`, `features/trips/labels.ts`,
  `features/trips/prefetch-cover.ts`, `i18n/create-i18n.ts`.
- `react-doctor/no-high-complexity-react-function` (1): the sign-in screen's four states are
  separate components (`VerifyingLink`, `LinkFailed`, `LinkSent`, `EmailForm`).

### Exceptions (`apps/customer/doctor.config.json`)

- `react-doctor/rn-scrollview-dynamic-padding` in `src/app/(tabs)/index.tsx`,
  `src/app/(tabs)/updates.tsx`, `src/app/invite.tsx`, `src/app/sign-in.tsx`,
  `src/app/trip/[id]/index.tsx`, `src/app/trip/[id]/updates.tsx` and `src/components/kit.tsx`
  (8 occurrences). Each non-literal `paddingTop`/`paddingBottom` is a safe-area inset plus a
  constant (`insets.top + space.*`, `insets.bottom + 96`), chosen per screen, never changed
  while scrolling; the sign-in keyboard is handled by `KeyboardAvoidingView`, not padding. The
  rule's own guidance says safe-area padding is cross-platform and `contentInset` is iOS-only and
  no replacement. Outcome: rejected (false positive). The globs use `?` for the route folders'
  brackets and parentheses, which match only these files.
