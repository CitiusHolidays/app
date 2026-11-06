import { Button, Text } from '@citius/ui';
import { Component, type ErrorInfo, type ReactNode, useState } from 'react';

import { Screen } from '@/components/kit';
import { logEvent } from '@/lib/safe-log';

/** The server's refusal codes that mean this account may no longer read trip data. */
const REVOKED_CODES = new Set(['FORBIDDEN', 'NOT_STAFF']);

export function isAccessRevokedError(error: unknown) {
  const data = typeof error === 'object' && error !== null ? (error as { data?: unknown }).data : undefined;
  return typeof data === 'string' && REVOKED_CODES.has(data);
}

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
    <Screen title={revoked ? 'Your access has changed' : 'Something went wrong'}>
      <Text>
        {revoked
          ? 'Citius no longer lets this account open trip data, so what was saved on this phone has been deleted.'
          : 'This screen could not be shown. Your saved trip data and unsent expenses are still on this phone.'}
      </Text>
      {revoked ? (
        <Text variant="secondary" tone="muted">
          If you think this is a mistake, ask HR or your manager to check your staff access.
        </Text>
      ) : null}
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
    </Screen>
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
