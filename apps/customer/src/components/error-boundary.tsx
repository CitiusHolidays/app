import { Button } from '@citius/ui';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { MessageScreen } from '@/components/kit';
import { useLaunchDone } from '@/components/launch-curtain';
import { useI18n } from '@/i18n/i18n';
import { closeScreen } from '@/lib/navigation';
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
  // Signing out removes the saved trips, which the message just promised are still here: ask first,
  // the same way Me does.
  const confirmSignOut = () =>
    Alert.alert(t('me.signOutConfirmTitle'), t('me.signOutConfirmBody'), [
      { style: 'cancel', text: t('common.cancel') },
      {
        onPress: () => {
          setBusy(true);
          void onSignOut().finally(() => setBusy(false));
        },
        style: 'destructive',
        text: t('error.signOut'),
      },
    ]);
  return (
    <MessageScreen
      actions={
        <>
          <Button label={t('common.retry')} onPress={onRetry} />
          <Button
            busy={busy}
            label={t('error.signOut')}
            onPress={confirmSignOut}
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

/**
 * One screen's own failure (a trip, the plan, an invite): the tabs and every other screen stay
 * usable, and Close leaves just this one. Exported as `ErrorBoundary` by those routes.
 */
export function ScreenError({ error, retry }: ErrorBoundaryProps) {
  const { t } = useI18n();
  useEffect(() => logEvent('app.screen-failed', error), [error]);
  return (
    <>
      <Stack.Screen options={{ headerShown: false, statusBarStyle: 'dark' }} />
      <MessageScreen
        actions={
          <>
            <Button label={t('common.retry')} onPress={() => void retry()} />
            <Button label={t('common.close')} onPress={closeScreen} variant="secondary" />
          </>
        }
        icon={{ ios: 'exclamationmark.triangle', md: 'warning' }}
        text={t('error.screenBody')}
        title={t('error.title')}
      />
    </>
  );
}
