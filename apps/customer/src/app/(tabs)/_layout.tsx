import { useAppTheme } from '@citius/ui';
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';

import { useCustomerSession } from '@/features/session/session';

import { useI18n } from '@/i18n/i18n';

/** Traveller tabs, always labelled. Tabs never animate between each other. */
export default function CustomerTabs() {
  const theme = useAppTheme();
  const { t } = useI18n();
  const { gate } = useCustomerSession();
  if (gate.kind !== 'signedIn') {
    return <Redirect href="/sign-in" />;
  }
  return (
    <NativeTabs labelStyle={{ selected: { color: theme.color.primary } }} labelVisibilityMode="labeled" tintColor={theme.color.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.journeys')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="flight_takeoff" sf="airplane" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="updates">
        <NativeTabs.Trigger.Label>{t('tabs.updates')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="campaign" sf="megaphone" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>{t('tabs.me')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="person" sf="person.crop.circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
