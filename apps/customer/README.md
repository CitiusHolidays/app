# Citius (customer app)

The travellers' app for Citius Holidays. A traveller signs in with a one-time email link, accepts
the trip invite Operations sent them, and sees their journeys: the trip happening now or next,
upcoming and past trips, the day-by-day plan, their tour managers' contacts, their documents'
status, and announcements from the tour manager. A parent sees the children linked to them on the
trip and gives or withdraws consent for each. The traveller can delete their account in the app.

It mirrors the website's customer account. There is no photo gallery and no payment in this
version.

The backend is the Citius website's Convex deployment. The functions the app calls are listed,
with the server check that protects each, in `packages/backend/src/customer.ts`. The customer app
imports only that file, so no staff function name ships in its bundle.

## How a traveller gets in

1. Operations open the Job Card in the portal, tick adult travellers under **Customer app
   invites** and create links. Each link works once and expires after 30 days (website ADR 0020).
   Minors never get a link; their guardians see them.
2. The link (`/app/invite#token=…`) opens a website page that hands the token to the app
   (`citius://invite?token=…`). A traveller whose link opened in a browser can paste it under
   **I have an invite link**.
3. Signed out, the app keeps the token and asks the traveller to sign in first. Sign-in emails a
   link (`/app/sign-in#token=…` → `citius://sign-in?token=…`); the app verifies it itself, so the
   session goes into SecureStore and never into a URL.
4. Signed in, the traveller sees who the invite is for, ticks consent for each child, and accepts.

A trip shows only while its Job Card's app pilot is on (the same switch as Citius Connect). Past
trips stay listed.

**SMS sign-in** is the other method the owner chose. It waits for the sent.dm account and DLT
registration; the seam is `src/features/auth/methods.ts`.

## Languages

English and Hindi are complete. Bengali, Marathi, Telugu, Tamil, Gujarati, Kannada, Malayalam,
Punjabi, Odia, Assamese and Urdu are listed as coming soon. To add one, fill
`src/i18n/locales/<code>.ts` with every key of `en.ts` and set `status: 'complete'` in
`src/i18n/languages.ts`; the tests list any missing key or changed placeholder. Indic scripts get
a quarter more line height from the theme. Urdu needs a right-to-left layout pass before it is
switched on.

The app opens in the phone's language when it is complete, else English, and the traveller can
change it under **Me → Language**. Trip plans and messages appear as Citius wrote them.

## Slow connections

Every screen opens from the last answer saved on the phone (an SQLCipher database whose key is in
SecureStore) and then updates live, with an "Updated 07:12" line while it shows saved data. If the
server does not answer within 8 seconds, or the phone is offline, a signed-in traveller still gets
their saved trips. Signing out or deleting the account deletes them. The app bundles no images
beyond its own mark.

## Setup

1. Install dependencies from the repository root:

   ```bash
   bun install
   ```

2. Copy `.env.example` to `.env.local` and fill in the two Convex URLs for your deployment.

## Run a development build

Sign-in works only from a development or release build, because the backend trusts the app's
`citius://` scheme as its auth origin. Expo Go uses its own scheme, so it is not supported.

```bash
bunx expo run:ios
bunx expo run:android
```

For a local backend on the Android emulator, forward the ports first:

```bash
adb reverse tcp:3310 tcp:3310 && adb reverse tcp:3311 tcp:3311 && adb reverse tcp:8081 tcp:8081
```

A local backend has no email provider, so sign-in and invite links are not delivered. Open them on
the simulator with `xcrun simctl openurl booted "citius://sign-in?token=…"` or
`adb shell am start -a android.intent.action.VIEW -d "citius://sign-in?token=…"`.

## Checks

Run these from `apps/customer`:

```bash
bunx tsc --noEmit
bunx expo lint
bunx jest
```

The backend contract test (in the Connect suite, which also runs the shared packages' tests)
compares `packages/backend` with a checkout of the website:

```bash
cd ../connect && CITIUS_WEBSITE_DIR=/path/to/website bunx jest contract
```
