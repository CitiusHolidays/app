import type { InvitePreview } from '@citius/backend/customer';

import type { MessageKey } from '@/i18n/locales/en';

export type ValidInvite = Extract<InvitePreview, { status: 'valid' }>;

/** Accepting an invite: ready (with the last failure, if any), out to the server, or done. */
export type AcceptState =
  | { kind: 'ready'; problem: MessageKey | null }
  /** The invite as it was when Accept was tapped: the screen keeps showing it until the answer. */
  | { invite: ValidInvite; kind: 'accepting' }
  | { destination: string | null; kind: 'added'; tripId: string | null };

export const READY: AcceptState = { kind: 'ready', problem: null };

/** The trip the invite added: shown by name, and opened only when it is open to the traveller yet. */
export function added(invite: ValidInvite, tripId: string): AcceptState {
  return { destination: invite.trip?.destination ?? null, kind: 'added', tripId: invite.trip ? tripId : null };
}

/** What the signed-in invite screen shows. */
export type InviteView =
  | { destination: string | null; kind: 'added'; tripId: string | null }
  | { kind: 'loading' }
  /** Already on this account: open the trip. */
  | { kind: 'yours'; tripId: string }
  | { kind: 'refused'; reason: 'expired' | 'used' | 'invalid' }
  | { accepting: boolean; invite: ValidInvite; kind: 'invite'; problem: MessageKey | null };

/**
 * The invite preview is live, so it turns "claimed by you" the moment the claim lands, which can be
 * before the claim's own answer reaches the screen. While Accept is out the screen therefore stays
 * on the invite it accepted, and "You're all set" follows the answer, not the preview.
 */
export function inviteView(preview: InvitePreview | undefined, accept: AcceptState): InviteView {
  if (accept.kind === 'added') return accept;
  if (accept.kind === 'accepting') return { accepting: true, invite: accept.invite, kind: 'invite', problem: null };
  if (preview === undefined) return { kind: 'loading' };
  switch (preview.status) {
    case 'valid':
      return { accepting: false, invite: preview, kind: 'invite', problem: accept.problem };
    case 'claimed_by_you':
      return { kind: 'yours', tripId: preview.tripId };
    case 'expired':
    case 'used':
      return { kind: 'refused', reason: preview.status };
    default:
      return { kind: 'refused', reason: 'invalid' };
  }
}
