import { staffTheme } from '@citius/ui';
import { NativeTabs } from 'expo-router/native-tabs';

import { useStaffSession } from '@/features/gate/session';

/** Staff tabs, composed by server role. Tabs never animate between each other (D2). */
export default function StaffTabs() {
  const { isTourManager } = useStaffSession();
  return (
    <NativeTabs labelStyle={{ selected: { color: staffTheme.color.primary } }} tintColor={staffTheme.color.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="today" sf="sun.max" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger hidden={!isTourManager} name="trip">
        <NativeTabs.Trigger.Label>Trip</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="luggage" sf="suitcase" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="expenses">
        <NativeTabs.Trigger.Label>Expenses</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="receipt_long" sf="doc.text" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="inbox" sf="tray" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="person" sf="person.crop.circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
