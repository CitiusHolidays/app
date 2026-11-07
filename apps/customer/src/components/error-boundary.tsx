import { Button } from '@citius/ui';
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';

import { MessageScreen } from '@/components/kit';
import { useLaunchDone } from '@/components/launch-curtain';
import { useI18n } from '@/i18n/i18n';
import { logEvent } from '@/lib/safe-log';

interface Props {
  children: ReactNode;
  onSignOut: () => Promise<void>;
}

function Fallback({ onRetry, onSignOut }: { onRetry: () => void; onSignOut: () => Promise<void> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  // A failure while the app was still starting must not stay hidden behind the loading screen.
  const launchDone = useLaunchDone();
  useEffect(launchDone, [launchDone]);
  return (
    <MessageScreen
      actions={
        <>
          <Button label={t('common.retry')} onPress={onRetry} />
          <Button
            busy={busy}
            label={t('error.signOut')}
            onPress={() => {
              setBusy(true);
              void onSignOut().finally(() => setBusy(false));
            }}
            variant="secondary"
          />
        </>
      }
      icon={{ ios: 'exclamationmark.triangle', md: 'warning' }}
      text={t('error.body')}
      title={t('error.title')}
    />
  );
}

/** Catches a render or query error below the root layout and offers a way out instead of a crash. */
export class AppErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    logEvent('app.render-failed', error);
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return <Fallback onRetry={() => this.setState({ failed: false })} onSignOut={this.props.onSignOut} />;
  }
}
