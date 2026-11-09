# Connect: Today and the trip pack

Today shows the Tour Manager's current or next trip, with the destination photo, headcount and
what is next. The Trip tab holds the pack: roster, schedule and contacts, saved on the phone for
offline use.

## Sub-features

- Today (`src/app/(app)/index.tsx`): trip hero, headcount card, spend card.
- Trip tab (`src/app/(app)/trip.tsx`): roster, schedule, contacts, call buttons.
- Offline copy: the pack opens with the network cut, for up to 14 days after the last verified
  sign-in.

## How to get to it (user POV)

Sign in (see connect-sign-in.md). Today is the first tab; **Trip** is the second.

## Driving it with the iOS Simulator tool or agent-device

1. `verify.sh shot connect today` once the skeletons have been replaced by content.
2. Tap the **Trip** tab; `verify.sh shot connect trip`.
3. Offline: stop the local backend's traffic (pause its process with `kill -STOP <pid>` and
   resume with `kill -CONT <pid>` afterwards, only for a local backend you started), relaunch with
   `verify.sh launch connect`, and `verify.sh shot connect today-offline`.

## Gotchas

- Proof of loading states: shoot during load too; the skeleton should be close to the size of
  the loaded card (no jump).
- Offline proof needs a relaunch; a live screen that merely keeps its last render is not proof.
- Never pause a backend process you did not start.
