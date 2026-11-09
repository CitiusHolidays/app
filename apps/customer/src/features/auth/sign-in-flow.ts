import type { LinkState } from '@/features/session/after-sign-in';

/** What can go wrong while asking for a link, as the words the screen shows. */
export type SendProblem = 'signIn.emailRequired' | 'signIn.emailInvalid' | 'signIn.network' | 'signIn.tooMany';

/**
 * Asking for a link: the form, or "check your email" once a link went out. Either can be sending
 * and either can carry the last problem, so a failed "Send it again" is shown where it was tapped.
 */
export type SendState =
  | { kind: 'form'; problem: SendProblem | null; sending: boolean }
  | { at: number; kind: 'sent'; problem: SendProblem | null; sending: boolean; to: string };

/** The sign-in screen: an email link being opened here, and asking for one. */
export interface SignInState {
  link: LinkState;
  send: SendState;
}

export type SignInAction =
  | { type: 'edited' }
  | { problem: SendProblem; type: 'refused-input' }
  | { type: 'sending' }
  | { at: number; to: string; type: 'sent' }
  | { problem: SendProblem; type: 'send-failed' }
  | { type: 'use-other' }
  | { link: LinkState; type: 'link' };

export function initialSignIn(hasToken: boolean): SignInState {
  return { link: hasToken ? { kind: 'opening' } : { kind: 'none' }, send: { kind: 'form', problem: null, sending: false } };
}

export function signInReducer(state: SignInState, action: SignInAction): SignInState {
  const { send } = state;
  switch (action.type) {
    case 'link':
      return { ...state, link: action.link };
    case 'edited':
      return send.problem ? { ...state, send: { ...send, problem: null } } : state;
    case 'refused-input':
      return { ...state, send: { ...send, problem: action.problem } };
    case 'sending':
      return { ...state, send: { ...send, problem: null, sending: true } };
    case 'sent':
      return { ...state, send: { at: action.at, kind: 'sent', problem: null, sending: false, to: action.to } };
    case 'send-failed':
      return { ...state, send: { ...send, problem: action.problem, sending: false } };
    case 'use-other':
      return { ...state, send: { kind: 'form', problem: null, sending: false } };
  }
}

/** The one view the sign-in sheet shows. */
export type SignInBody = 'verifying' | 'failed-network' | 'failed-refused' | 'sent' | 'form';

/**
 * A link being opened wins (and stays on "signing you in" until the session is live), then a link
 * that failed, then "check your email", then the form.
 */
export function signInBody(state: SignInState, signedIn: boolean): SignInBody {
  const { link, send } = state;
  if (link.kind === 'opening' || (link.kind === 'opened' && !signedIn)) return 'verifying';
  if (link.kind === 'failed') return link.reason === 'network' ? 'failed-network' : 'failed-refused';
  return send.kind;
}
