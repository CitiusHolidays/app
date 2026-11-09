import { Button } from '@citius/ui';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { MessageScreen } from '@/components/kit';
import { isAccessRevokedError } from '@/features/gate/access-revoked';
import { SignOutButton } from '@/features/gate/sign-out-button';
import { logEvent } from '@/lib/safe-log';

interface Props {
  children: ReactNode;
  /** Deletes the cached verification and every saved trip, headcount, announcement and expense. */
  onRevoked: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

/**
 * `ok`: the app is shown. `failed`: a render or query error, nothing deleted. `revoked`: the server
 * refused this account (FORBIDDEN or NOT_STAFF), so the phone's data has been deleted.
 */
export type BoundaryStatus = 'ok' | 'failed' | 'revoked';

interface State {
  status: BoundaryStatus;
}

const OK: State = { status: 'ok' };

function Fallback({ onRetry, onSignOut, revoked }: { onRetry: () => void; onSignOut: () => Promise<void>; revoked: boolean }) {
  return (
    <MessageScreen
      actions={
        <>
          <Button label="Try again" onPress={onRetry} />
          <SignOutButton onSignOut={onSignOut} variant="secondary" />
        </>
      }
      detail={revoked ? 'If you think this is a mistake, ask HR or your manager to check your staff access.' : undefined}
      icon={revoked ? { ios: 'lock', md: 'lock' } : { ios: 'exclamationmark.triangle', md: 'warning' }}
      text={
        revoked
          ? 'Citius no longer lets this account open trip data, so what was saved on this phone has been deleted.'
          : 'This screen could not be shown. Your saved trip data and unsent expenses are still on this phone.'
      }
      title={revoked ? 'Your access has changed' : 'Something went wrong'}
    />
  );
}

/**
 * Catches a render or query error anywhere below the root layout and shows a screen with a way
 * out, instead of a crash. A FORBIDDEN or NOT_STAFF refusal (for example after the account is
 * deactivated) also deletes everything saved on the phone.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = OK;

  static getDerivedStateFromError(error: unknown): State {
    return { status: isAccessRevokedError(error) ? 'revoked' : 'failed' };
  }

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    logEvent('app.render-failed', error);
    if (isAccessRevokedError(error)) {
      this.props.onRevoked().catch((wipeError: unknown) => logEvent('session.clear-failed', wipeError));
    }
  }

  render() {
    const { status } = this.state;
    if (status === 'ok') {
      return this.props.children;
    }
    return (
      <Fallback
        onRetry={() => this.setState(OK)}
        onSignOut={async () => {
          await this.props.onSignOut();
          this.setState(OK);
        }}
        revoked={status === 'revoked'}
      />
    );
  }
}
