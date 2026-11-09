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

/** What can go wrong on a step, as the words the screen shows. */
export type DeletionProblem = 'delete.failed' | 'signIn.network' | 'signIn.tooMany';

/**
 * What the traveller last did on the screen. A failure belongs to the step it happened on, so it
 * leaves with that step (a "too many attempts" from asking for a link is not shown over "type
 * DELETE" once the traveller is back from a link sent earlier).
 */
export type DeletionAction =
  | { kind: 'idle' }
  /** `sent`: a link already went out, so "Link sent" stays up while another is asked for. */
  | { kind: 'sending-link'; sent: boolean }
  | { kind: 'link-sent' }
  | { kind: 'deleting' }
  /** `sent`: an earlier link is still on its way, so "Link sent" stays up beside the failure. */
  | { kind: 'failed'; problem: DeletionProblem; sent: boolean; step: DeletionStep }
  | { kind: 'deleted'; reference: string };

export function deletionBusy(action: DeletionAction) {
  return action.kind === 'sending-link' || action.kind === 'deleting';
}

export function deletionLinkSent(action: DeletionAction) {
  if (action.kind === 'link-sent') return true;
  return (action.kind === 'sending-link' || action.kind === 'failed') && action.sent;
}

/** The failure to show on this step, if it happened here. */
export function deletionProblem(action: DeletionAction, step: DeletionStep): DeletionProblem | null {
  return action.kind === 'failed' && action.step === step ? action.problem : null;
}
