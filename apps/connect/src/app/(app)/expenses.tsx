import { space } from '@citius/ui';
import { View } from 'react-native';

import { Screen, SectionTitle } from '@/components/kit';
import { OnThisPhone, type PhoneExpense, SubmittedList } from '@/features/expenses/expense-lists';
import { useOutbox } from '@/features/expenses/outbox-context';
import { useServerExpenses } from '@/features/expenses/server-expenses';
import { SpendCard } from '@/features/expenses/spend-card';
import { spendEntries, submittedRows } from '@/features/expenses/totals';
import { useTrips } from '@/features/trips/trips-context';

/** "What have I spent and has it been sent?" */
export default function Expenses() {
  const { discard, items, retry } = useOutbox();
  const { selected, trips } = useTrips();
  const server = useServerExpenses(selected?.id ?? null);
  // The spend and the submitted list are the selected trip's; with no trip, everything on the phone.
  const tripItems = selected ? items.filter((item) => item.jobCardId === selected.id) : items;
  // Sent expenses leave the phone's list (the server list shows them); unsent ones show for every trip.
  const onPhone: PhoneExpense[] = items
    .filter((item) => item.status !== 'done')
    .map((item) => ({
      item,
      otherTrip: !selected || item.jobCardId === selected.id ? null : (trips.find((trip) => trip.id === item.jobCardId)?.jobCode ?? 'Another trip'),
    }));
  const serverRows = server.kind === 'loaded' ? server.rows : null;
  const entries = spendEntries(tripItems, serverRows);
  const submitted = serverRows ? submittedRows(tripItems, serverRows) : [];
  return (
    <Screen kicker={selected?.jobCode} title="Expenses">
      <SpendCard
        entries={entries}
        label={serverRows ? 'Spent on this trip' : 'Saved on this phone'}
        loading={server.kind === 'loading'}
        partial={server.kind === 'loaded' && !server.complete}
      />
      <OnThisPhone entries={onPhone} onDiscard={discard} onRetry={retry} />
      <View style={{ gap: space.md }}>
        <SectionTitle>Submitted for this trip</SectionTitle>
        <SubmittedList hasLocal={tripItems.some((item) => item.status !== 'done')} server={server} submitted={submitted} />
      </View>
    </Screen>
  );
}
