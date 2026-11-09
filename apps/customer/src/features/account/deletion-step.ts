import type { DeletionEligibility } from '@citius/backend/customer';

/** What the server said about deleting this account, or why it hasn't said yet. */
export type DeletionCheck =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'error' }
  | { kind: 'answer'; value: DeletionEligibility };

/** The one step the delete-account screen shows. */
export type DeletionStep = 'offline' | 'loading' | 'error' | 'unavailable' | 'staff' | 'ready' | 'reauth';

/**
 * Picks the step from the check, whether the profile (and so the email) has arrived, and whether
 * the phone is offline. Waiting while offline says so instead of a placeholder that never ends.
 */
export function deletionStep(check: DeletionCheck, input: { offline: boolean; profileLoaded: boolean }): DeletionStep {
  if (check.kind === 'loading' || !input.profileLoaded) return input.offline ? 'offline' : 'loading';
  if (check.kind !== 'answer') return check.kind;
  if (check.value?.status === 'staff_account') return 'staff';
  if (check.value?.status === 'ready') return 'ready';
  return 'reauth';
}
