# Customer: accept a trip invite

Operations send an adult traveller an invite link. Signed in, the traveller sees who the invite
is for, gives consent for each linked child, and accepts. The trip then shows on Journeys.

## Sub-features

- Invite screen (`src/app/invite.tsx`): who it is for, consent per child, **Accept invite**.
- Paste entry (`src/app/invite-entry.tsx`): "I have an invite link".
- Signed out: the app keeps the token, asks for sign-in first, then returns to the invite.
- "You're all set" moment (`src/components/invite-added.tsx`).

## How to get to it (user POV)

The invite link opens the website, which hands it to the app as `citius://invite?token=…`.

## Driving it with the iOS Simulator tool or agent-device

1. Create an invite on a local backend (Job Card → Customer app invites) and copy its token.
2. `verify.sh link customer "citius://invite?token=<token>"`; `verify.sh shot customer invite`.
3. Signed out: sign in (customer-sign-in-link.md); the app must come back to the invite.
4. Tick consent for each child, tap **Accept invite**; `verify.sh shot customer invite-accepted`.
5. Close; `verify.sh shot customer journeys-with-trip`.

## Gotchas

- The trip shows only while its Job Card's app pilot switch is on.
- "Not you? Sign out" must keep the pending invite.
- Each invite works once; make a new one per run.
