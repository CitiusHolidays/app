# Connect: add an expense with a receipt

A Tour Manager records a trip expense with a receipt photo; it queues on the phone and sends when
online.

## Sub-features

- Expenses list (`src/app/(app)/expenses.tsx`): **Add expense**, unsent items with **Try again**
  and **Delete**.
- New expense (`src/app/expense-new.tsx`): **Trip** chips, **Take receipt photo**, **Amount**,
  **Currency**, **Category**, **Date**, **What it was for**, **Save expense**.

## How to get to it (user POV)

Expenses tab, then **Add expense**.

## Driving it with the iOS Simulator tool or agent-device

1. Tap **Expenses**, then **Add expense**; `verify.sh shot connect expense-new`.
2. Receipt: the simulator has no camera. Add a photo to the library first with
   `xcrun simctl addmedia $CITIUS_IOS_SIM <image>` if the flow offers the library; otherwise
   record the receipt step as unverified on the simulator.
3. Fill **Amount** (`120`), pick a **Category**, fill **What it was for**, tap **Save expense**.
4. `verify.sh shot connect expenses-after-save`.

## Gotchas

- Proof is the item in the list once, not twice, and the row on the backend (check in the local
  Convex dashboard). A sent expense listed twice is a known finding.
- Delete must ask before removing, and must remove the server draft too.
- Only create expenses on a local backend.
