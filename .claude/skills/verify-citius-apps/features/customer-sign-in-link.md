# Customer: sign in with an email link

A traveller enters their email, gets a one-time link, and the app signs them in from the link.

## Sub-features

- Email entry (`src/app/sign-in.tsx`): **Email address** field, **Email me a sign-in link**.
- Sent state: resend countdown, **Use a different email**.
- Link handling: `citius://sign-in?token=…` verifies in the app; a failed link offers a new one.
- SMS is listed as coming soon (disabled).

## How to get to it (user POV)

Open the app signed out; the sign-in screen is the first screen.

## Driving it with the iOS Simulator tool or agent-device

1. `verify.sh launch customer`; `verify.sh shot customer sign-in`.
2. Type a synthetic traveller email in **Email address**; tap **Email me a sign-in link**;
   `verify.sh shot customer link-sent`.
3. A local backend sends no email. Take the token from the local backend's delivery record and
   open it: `verify.sh link customer "citius://sign-in?token=<token>"`.
4. `verify.sh shot customer journeys-after-sign-in`.

## Gotchas

- Opening the same link twice must not land on the wrong screen; check a second open.
- A failed link must say why (expired, used, or network), not always "expired".
- Never use a real traveller's email; only synthetic seed accounts.
