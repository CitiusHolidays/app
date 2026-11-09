# Connect: sign in as a Tour Manager

A Tour Manager signs in with their Citius staff email and password and lands on Today with only
their assigned trips.

## Sub-features

- Email and password sign-in (`src/app/sign-in.tsx`).
- Show or hide password.
- Wrong password message.
- Role gates: a staff member without the Tour Manager role sees `not-tour-manager`; a non-staff
  account sees `not-staff`.

## How to get to it (user POV)

Open the app signed out. The sign-in screen shows the fields **Work email** and **Password** and
the **Sign in** button.

## Driving it with the iOS Simulator tool or agent-device

1. `verify.sh launch connect`, then `verify.sh shot connect sign-in`.
2. Fill **Work email** with the synthetic Tour Manager's email (agent-device:
   `fill 'label="name@citiusholidays.com"' <email> --settle`; the placeholder is the label).
3. Fill **Password** from the login file without printing it (SKILL.md, "Typing secrets").
   The field must show dots.
4. Tap **Sign in**. It is disabled while the request runs; Today appears within a few seconds.
5. `verify.sh shot connect today-after-sign-in`.

## Gotchas

- Proof: Today shows the Tour Manager's trip (the local seed's Job Card), not "No trips yet".
- After a sign-in, a relaunch must land on Today without the sign-in screen (session in
  SecureStore). Check with `verify.sh launch connect` again.
- A login for another role proves the gate screens; use one per role when the gate changed.
- A hanging backend leaves the button spinning; that is a known finding, not a harness fault.
