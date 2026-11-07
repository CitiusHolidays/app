# React Doctor triage record

React Doctor is pinned at `0.9.22` in the root `package.json`, the same pin as the website. It was
the latest release when this record was written (`npm view react-doctor version`). When a newer
release comes out, bump the pin to it, rerun the scans below, and triage anything new the same way.

React Doctor output is a hypothesis, not proof. Each finding was read in the source and either
fixed at the call site or kept as a narrow exception below, with the evidence for keeping it.

## Running it

```sh
bun run doctor                    # every project in doctor.config.json, with the score API and the supply-chain check
bunx react-doctor --no-telemetry --no-supply-chain --no-cache --yes --verbose --blocking warning   # what CI runs
```

CI (`.github/workflows/ci.yml`) fails on any error or warning in any project in
`doctor.config.json` (`apps/connect`, `apps/customer`, `packages/ui`, `packages/core`), which is what
a 100/100 score means. It runs the pinned version from the lockfile
with telemetry and the score API off, the Socket.dev supply-chain lookups off (third-party scores
can change without any change here, which would make the gate flaky), and no reuse of an earlier
scan. Run `bun run doctor` locally when dependencies change, to see the supply-chain check.


## Connect, ui and core: baseline and result

Baseline, app `main` at a90a3af: `packages/ui` and `packages/core` had no findings. `apps/connect`
had 38: 6 errors and 32 warnings.

Result: no diagnostics in any of the three, and a score of 100/100 for each
(`bunx react-doctor --score --yes --project <project>`).

### Fixed at the call site

| Rule | Where | Fix |
|---|---|---|
| `react-hooks-js/todo` ×6 (React Compiler bailouts) | `sign-in.tsx`, `outbox-context.tsx`, `field-sync-context.tsx`, `gate/session.tsx`, `trips-context.tsx` (`try`/`finally`); `passport/[id].tsx` (`throw` inside `try`) | The compiler cannot compile `finally` or a `throw` inside `try`. Sign-in resets its busy state after the `try`/`catch` (the `catch` cannot throw). Session sign-out and the trips refresh use `promise.finally`. The outbox and field-sync loops moved into plain functions, `drainOutbox` (`outbox.ts`) and `drainSyncQueue` (`queue.ts`), with tests. The passport open moved into `usePassportScan`, outside the screen. |
| `async-await-in-loop` ×2 | `pack-store.ts` | Each pack is checked and deleted on its own, so purging and pruning run together with `Promise.all`; results keep their order. |
| `js-hoist-intl` ×7 | `kit.tsx` ×2, `trip.tsx`, `announcement/[id].tsx`, `relative-time.ts` ×2, `passport-window.ts` | Formatters are built once at module level. The passport window's formatter depends on the time zone, so one is cached per zone. |
| `js-set-map-lookups` | `field-sync-context.tsx` | The keys to retry are a `Set`. |
| `no-array-index-as-key` | `trip.tsx` (contacts) | `contactKey` (role, name, phone) is unique by construction of the pack's contacts; tested. |
| `no-fetch-response-used-without-status-check` | `receipt-files.web.ts` | A picked photo that can no longer be read is refused as "Receipt file missing", the same as a missing file on a phone, instead of uploading an error body; tested. |
| `no-unsafe-json-parse` | `receipt-files.ts` | The upload answer is parsed and checked for a string `storageId`; anything else is a failed upload, which is retried; tested. |
| `rerender-lazy-ref-init` | `gate/session.tsx` | The task queue starts from one shared settled promise instead of a new one each render. |
| `rn-no-legacy-shadow-styles`, `rn-style-prefer-boxshadow` | `kit.tsx` (`Segmented`) | `boxShadow: '0 1px 6px rgba(0, 0, 0, 0.08)'`. React Native draws the blur at half its radius on iOS, so this matches the old iOS shadow (radius 3) and now shows on Android too. |
| `rn-scrollview-dynamic-padding` ×2 | `kit.tsx` (`Screen`, `MessageScreen`) | Safe-area room is a spacer view above and below the content, not padding on the content container. The total room, and the floating tab bar's clearance, are unchanged. |
| `only-export-components` ×7 | `kit.tsx`, `error-boundary.tsx`, `passport-pdf(.web).tsx` | `formatDateRange` and `dateKicker` moved to `lib/dates.ts` (tested), `haptic` to `lib/haptics.ts`, `isAccessRevokedError` to `features/gate/access-revoked.ts`, and the PDF view loader and `canShowPdf` to `passport-pdf` siblings `pdf-support(.web).ts`. `initials` is no longer exported. |
| `no-high-complexity-react-function` ×5 | `Expenses`, `Today`, `TripPackScreen`, `Headcount`, `PassportViewer` | Each screen's independent sections became child components (and `useTripSection`, `usePassportScan`), with the same output. |

On the iPhone 17 simulator, screenshots of Today, Trip (roster, schedule, contacts), Expenses and
Headcount, at the top and scrolled to the end, are pixel-identical before and after.

### Narrow exceptions

All exceptions are in `apps/connect/doctor.config.json`. Each names the exact file and rule.

| File | Rule | Why it stays |
|---|---|---|
| `apps/connect/src/features/expenses/outbox.ts` (`drainOutbox`) | `react-doctor/async-await-in-loop` | The expense outbox must send one item at a time, in queue order. Each item's saved stage is what a crash or a dropped connection resumes from, and a sign-out (the store fence) must stop the run before its next request. Running items together would send requests after a sign-out and lose the per-item resume point. `outbox.test.ts` ("sends due items one at a time, in order" and "stops at once when the store is wiped") pins both. |
| `apps/connect/src/features/field-sync/queue.ts` (`drainSyncQueue`) | `react-doctor/async-await-in-loop` | Headcount stops and announcements go to the office one at a time: a stop's newer state must not race its older one, and a sign-out must stop the run before its next push. The loop also reads the queue afresh when a change arrived during the run. `queue.test.ts` ("one at a time", "looks at the queue again", "stops without settling anything once the store is wiped") pins it. |

Each exception is a claim to recheck when its file changes. To audit them, remove the override
from `apps/connect/doctor.config.json` in a scratch checkout and rerun the scan: it reports exactly
these two findings.

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
