import type { ExpenseRow, JobCardRow } from '@citius/backend';
import { Button, space, Surface, Text, useAppTheme } from '@citius/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon, PageTitle, PlaceholderBar, QuietState, Screen, SectionTitle } from '@/components/kit';
import { formatMoney } from '@/features/expenses/format';
import { useCanReachServer } from '@/features/gate/reach';
import { fullTime } from '@/features/inbox/relative-time';
import { useInbox } from '@/features/inbox/use-inbox';
import { useMarkRead } from '@/features/inbox/use-mark-read';
import { useExpenseSummary, useJobCardSummary } from '@/features/inbox/use-notification-record';
import { useTrips } from '@/features/trips/trips-context';
import { formatDateRange } from '@/lib/dates';

interface Line {
  label: string;
  /** Undefined while the record loads: the row keeps its label and height, with a bar for the value. */
  value?: string;
}

/** Label and value rows on one card; the loading state is the same card with bars for the values. */
function Lines({ lines }: { lines: Line[] }) {
  const theme = useAppTheme();
  const loading = lines.some((line) => line.value === undefined);
  return (
    <Surface
      accessibilityLabel={loading ? 'Loading' : undefined}
      accessible={loading || undefined}
      style={{ paddingVertical: space.xs }}
    >
      {lines.map((line, index) => (
        <View
          accessible={!loading}
          accessibilityLabel={loading ? undefined : `${line.label}: ${line.value}`}
          key={line.label}
          style={{
            borderBottomColor: theme.color.rule,
            borderBottomWidth: index === lines.length - 1 ? 0 : StyleSheet.hairlineWidth,
            flexDirection: 'row',
            gap: space.md,
            paddingVertical: space.md,
          }}
        >
          <Text style={{ width: 104 }} tone="muted" variant="secondary">
            {line.label}
          </Text>
          {line.value === undefined ? (
            <View style={{ alignItems: 'flex-end', flex: 1 }}>
              <PlaceholderBar role="secondary" width="60%" />
            </View>
          ) : (
            <Text style={{ flex: 1, textAlign: 'right' }} tabular variant="secondary">
              {line.value}
            </Text>
          )}
        </View>
      ))}
    </Surface>
  );
}

/** A Job Card's summary lines; without the record, the same labels with bars for the values. */
const jobCardLines = (job?: JobCardRow): Line[] => [
  { label: 'Job Card', value: job?.jobCode },
  { label: 'Client', value: job?.clientName },
  { label: 'Destination', value: job && (job.destination || 'Not set') },
  { label: 'Dates', value: job && formatDateRange(job.travelStartDate, job.travelEndDate) },
  { label: 'Status', value: job?.status },
];

/** An expense's summary lines; without the record, the same labels with bars for the values. */
const expenseLines = (expense?: ExpenseRow): Line[] => [
  { label: 'Amount', value: expense && formatMoney(expense.amount, expense.currency) },
  { label: 'Category', value: expense?.category },
  { label: 'Job Card', value: expense?.jobCode },
  { label: 'Approval', value: expense?.approvalStatus },
  { label: 'Manager', value: expense?.managerReviewStatus },
];

function JobCardSummary({ id }: { id: string }) {
  const job = useJobCardSummary(id);
  if (job === null) {
    return (
      <Surface>
        <QuietState text="This Job Card is not visible to you." />
      </Surface>
    );
  }
  return <Lines lines={jobCardLines(job)} />;
}

function ExpenseSummary({ id }: { id: string }) {
  const expense = useExpenseSummary(id);
  if (expense === null) {
    return (
      <Surface>
        <QuietState text="This expense is not visible to you." />
      </Surface>
    );
  }
  return <Lines lines={expenseLines(expense)} />;
}

/** Records the app sums up on this screen; anything else is only on the portal. */
const SUMMARISED = new Set(['jobCard', 'expense']);

/** A notification and a short summary of its record. Read-only; the portal holds the full record. */
export default function NotificationDetail() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rows } = useInbox();
  const { selectTrip, trips } = useTrips();
  const notification = rows.find((row) => row.id === id);
  const canReachServer = useCanReachServer();
  useMarkRead(notification, canReachServer);
  if (!notification) {
    return (
      <Screen tabBar={false}>
        <Surface>
          <QuietState text="This notification is not on this phone. Open the inbox while online to refresh it." />
        </Surface>
      </Screen>
    );
  }
  const canQuery = canReachServer && Boolean(notification.entityId);
  const trip = notification.entityType === 'jobCard' ? trips.find((candidate) => candidate.id === notification.entityId) : undefined;
  return (
    <Screen tabBar={false}>
      <PageTitle kicker={fullTime(notification.createdAt) || undefined} title={notification.title} />
      <Surface>
        <Text selectable>{notification.body}</Text>
      </Surface>
      {canQuery && notification.entityType === 'jobCard' ? (
        <View style={{ gap: space.md }}>
          <SectionTitle>Job Card</SectionTitle>
          <JobCardSummary id={notification.entityId} />
        </View>
      ) : null}
      {canQuery && notification.entityType === 'expense' ? (
        <View style={{ gap: space.md }}>
          <SectionTitle>Expense</SectionTitle>
          <ExpenseSummary id={notification.entityId} />
        </View>
      ) : null}
      {trip ? (
        <Button
          icon={<Icon color={theme.color.onPrimary} ios="suitcase" md="luggage" size={16} />}
          label="Open trip"
          onPress={() => {
            selectTrip(trip.id);
            router.navigate('/trip');
          }}
        />
      ) : null}
      {!canReachServer ? (
        <Text tone="muted" variant="secondary">
          Connect to load the full record.
        </Text>
      ) : !canQuery || !SUMMARISED.has(notification.entityType) ? (
        <Text tone="muted" variant="secondary">
          Open the Citius portal for the full record.
        </Text>
      ) : null}
    </Screen>
  );
}
