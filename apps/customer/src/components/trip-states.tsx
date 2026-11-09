import { Button } from '@citius/ui';
import { Stack } from 'expo-router';

import { MessageScreen, QuietState } from '@/components/kit';
import { useI18n } from '@/i18n/i18n';
import { closeScreen } from '@/lib/navigation';

/** A trip the server says this traveller can't see (paused, or access changed). */
export function TripUnavailable() {
  const { t } = useI18n();
  return (
    <>
      <Stack.Screen options={{ statusBarStyle: 'dark' }} />
      <MessageScreen
        actions={<Button label={t('common.close')} onPress={closeScreen} variant="secondary" />}
        icon={{ ios: 'eye.slash', md: 'visibility_off' }}
        text={t('trip.notAvailableBody')}
        title={t('trip.notAvailableTitle')}
      />
    </>
  );
}

/** Offline (or signed out) with nothing saved for this view: say so instead of a placeholder that never ends. */
export function NotSaved() {
  const { t } = useI18n();
  return <QuietState text={t('common.notSaved')} />;
}
