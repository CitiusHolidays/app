# Citius Connect

The staff app for Citius Holidays tour managers. A tour manager signs in with their Citius staff
account and sees only the trips assigned to them: the trip pack (roster, schedule and contacts),
headcounts, announcements to travellers, and expenses with receipt photos. Trip data is saved on
the phone in an encrypted store, so the app keeps working offline on tour for up to 14 days after
the account was last verified with the server.

Only staff with the Tour Manager role can use the app. Other staff are shown a screen that says so.

The backend is the Citius website's Convex deployment. The functions the app calls are listed in
`packages/backend`.

## Setup

1. Install dependencies from the repository root:

   ```bash
   bun install
   ```

2. Copy `.env.example` to `.env.local` and fill in the two Convex URLs for your deployment.

## Run a development build

Sign-in only works from a development or release build, because the backend trusts the app's
`citiusconnect://` scheme as its auth origin. Expo Go uses its own scheme, so it is not supported.

```bash
bunx expo run:ios
bunx expo run:android
```

## Checks

Run these from `apps/connect`:

```bash
bunx tsc --noEmit
bunx expo lint
bunx jest
```

`bun run typecheck` from the repository root type-checks every package.

The backend contract test compares `packages/backend` with a checkout of the website. It is skipped
unless `CITIUS_WEBSITE_DIR` points at that checkout:

```bash
CITIUS_WEBSITE_DIR=/path/to/website bunx jest
```
