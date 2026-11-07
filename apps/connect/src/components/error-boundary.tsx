import { Button } from '@citius/ui';
import { Component, type ErrorInfo, type ReactNode, useState } from 'react';

import { MessageScreen } from '@/components/kit';
import { isAccessRevokedError } from '@/features/gate/access-revoked';
import { logEvent } from '@/lib/safe-log';

interface Props {
  children: ReactNode;
  /** Deletes the cached verification and every saved trip, headcount, announcement and expense. */
  onRevoked: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

interface State {
  failed: boolean;
  revoked: boolean;
}

function Fallback({ onRetry, onSignOut, revoked }: { onRetry: () => void; onSignOut: () => Promise<void>; revoked: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <MessageScreen
      actions={
        <>
          <Button label="Try again" onPress={onRetry} />
          <Button
            busy={busy}
            label="Sign out"
            onPress={() => {
              setBusy(true);
              void onSignOut().finally(() => setBusy(false));
            }}
            variant="secondary"
          />
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
  state: State = { failed: false, revoked: false };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, revoked: isAccessRevokedError(error) };
  }

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    logEvent('app.render-failed', error);
    if (isAccessRevokedError(error)) {
      this.props.onRevoked().catch((wipeError: unknown) => logEvent('session.clear-failed', wipeError));
    }
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <Fallback
        onRetry={() => this.setState({ failed: false, revoked: false })}
        onSignOut={async () => {
          await this.props.onSignOut();
          this.setState({ failed: false, revoked: false });
        }}
        revoked={this.state.revoked}
      />
    );
  }
}
