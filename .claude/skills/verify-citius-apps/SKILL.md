---
name: verify-citius-apps
description: Drive Citius Connect (staff app) or the Citius customer app on an iOS Simulator (or Android emulator) the way a user does, and capture screenshots as proof. Use before claiming a UI, flow, sign-in, offline or motion change works, after `bun run test` passes, or when asked to "check it on the simulator/device".
---

# Verify the Citius apps on a device

Unit tests prove logic. This skill proves the installed app does the thing. Both apps are Expo SDK
58 development builds that talk to a Convex backend; Expo Go cannot sign in (the backend trusts
only the `citiusconnect://` and `citius://` schemes).

Helper: `.claude/skills/verify-citius-apps/scripts/verify.sh <command> <connect|customer> [arg]`
(called `verify.sh` below). Run it from anywhere in the repo or a worktree; it works on the
checkout it lives in.

## Setup the run needs (once per machine)

| Need | How |
| --- | --- |
| A simulator with the dev build | `cd apps/<app> && bunx expo run:ios --device <UDID> --no-bundler` (10+ min first time). Then `export CITIUS_IOS_SIM=<UDID>`. Give Connect and the customer app different simulators, and always pass the UDID: `simctl … booted` hits whichever simulator happens to be booted, which may be another session's. |
| A backend | `apps/<app>/.env.local` (gitignored) with `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CONVEX_SITE_URL`. Prefer a local Convex backend (`http://127.0.0.1:3210` and `:3211`) with synthetic seed data. |
| A test login (Connect) | `export CITIUS_VERIFY_LOGIN_FILE=<local file>` holding `email=` and `password=` lines for a synthetic Tour Manager. Keep it outside the repo: this repo is public. |
| Evidence folder (optional) | `CITIUS_VERIFY_OUT` (default `$TMPDIR/citius-verify-evidence`). |

Never point a verification run at production to create, edit or delete anything. `doctor` warns
when the backend is not local; on a non-local backend, only read.

## Doctor (run first, and whenever something looks off)

```bash
verify.sh doctor connect     # or customer
```

Ends in `READY` or `NOT READY` with the failing line. It checks the backend's auth route answers,
the simulator state, that the app is installed, and who owns the Metro port (Connect 8082,
customer 8081). If the port is held by Metro for another checkout, another session owns it: do
not kill it; wait or use the other app's simulator.

## Launch

```bash
verify.sh launch connect
```

Boots the simulator if needed, starts Metro with `--clear` (some machines have no watchman, and
Metro then serves stale code), points the app at it, launches it, and waits for the `Bundled` line
in the Metro log. Ready means that line is printed and the first screen renders (take a `shot`).
A relaunch with unchanged code may print `entry.js (1 module)`, which is a cache hit. If an edit
you made is not visible after a relaunch, Metro served a stale bundle: `cleanup`, then `launch`
again.

## Drive

Use whichever harness the session has, in this order:

1. **Claude desktop:** the iOS Simulator tool (`mcp__Claude_Code_iOS_Simulator__control`):
   `screenshot`, then `tap` at points read from that screenshot, `text` to type,
   `press_key return`. The user must grant access to each simulator once in the simulator
   panel; if the grant is pending (the user is away), use agent-device instead of waiting.
2. **Anywhere else:** `npx -y agent-device@0.21.36`.
   - Start with `open <bundle id> --platform ios --udid "$CITIUS_IOS_SIM" --foreground`; it
     prints the first snapshot with `@eN` refs from the accessibility labels.
   - Sessions are keyed by the working directory: run every later command from the folder you
     ran `open` in, and end with `close`.
   - Refs go stale after each action. Use the pinned ref the last diff printed (`@e10~s750812`)
     or a selector (`'label="Sign in"'`, `'role=securetextfield'`), never coordinates.
   - `fill <target> <text> --settle` replaces the field and prints the UI diff; it does not
     drop characters the way typed text can.
3. **No harness:** `verify.sh link` for deep links plus `verify.sh shot` after each step.

Stable handles: the accessibility labels and visible copy listed in each feature file under
`features/`. Tab names in Connect: Today, Trip, Expenses, Inbox, Me.

Typing: tap the field, take a screenshot so the keyboard has settled, then send the text. Text
sent while the keyboard is still sliding up loses characters. Read the field back in a screenshot.

Typing secrets: never type, echo or screenshot a password in plain text.
- agent-device: fill the secure field straight from the login file; it prints only a character
  count, and `--no-record` keeps the value out of the session recording:
  `fill 'role=securetextfield' "$(grep -E '^password=' "$CITIUS_VERIFY_LOGIN_FILE" | cut -d= -f2-)" --no-record`
- iOS Simulator tool: `verify.sh paste-login connect password` puts the password on the
  simulator pasteboard without printing it; tap the field, then tap it again and choose Paste.
  The iOS edit menu pages between AutoFill and Paste, and an automated "Previous Page" press
  dismisses it, so this route needs a screenshot after each tap.
- `cleanup` clears the pasteboard; do it before handing the simulator to anyone else.

Android (when the change is platform-specific): Connect uses `emulator-5556` and Metro 8082,
the customer app `emulator-5554` and 8081. Run `adb -s <serial> reverse tcp:<port> tcp:<port>`
for Metro and for 3210/3211 with a local backend, and set the dev client's `debug_http_host` to
`127.0.0.1:<port>`. Screenshots: `adb -s <serial> exec-out screencap -p > "$OUT/<name>.png"`.

## Evidence

```bash
verify.sh shot connect today-loaded     # prints the PNG path
```

A proof is the user path, not a shortcut: start from the screen a user starts on, take a shot
before the action and after the resulting state, and check the side effect (the row on the
backend, the saved item after a relaunch, the offline copy with the network cut). No test-only
endpoints and no state set from code. Name files `<app>-<step>.png`. Read the screenshots back
and say what they show; a file existing is not a pass. Recordings:
`xcrun simctl io $CITIUS_IOS_SIM recordVideo --codec h264 "$OUT/<name>.mp4"` (Ctrl-C to stop).

## Cleanup

```bash
verify.sh cleanup connect
```

Stops the app, clears the simulator pasteboard, stops only the Metro this script started, and
shuts the simulator down only if `launch` booted it. Evidence in `$OUT` stays. Never `pkill node`
or `killall Simulator`: other sessions share this machine.

## Feature map

`features/README.md` lists the user-facing journeys with how to reach, drive and prove each one.
A proof that drives one entry point is incomplete when the map lists others. Keep the map current
with `/maintain-verification-skill` when screens change.
