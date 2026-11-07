import { staffApi } from '@citius/backend';
import { Button, space, Surface, Text, useAppTheme } from '@citius/ui';
import { useQuery } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon, PageTitle, Placeholder, QuietState, Screen, SectionTitle } from '@/components/kit';
import { formatMoney } from '@/features/expenses/format';
import { useStaffSession } from '@/features/gate/session';
import { fullTime } from '@/features/inbox/relative-time';
import { useInbox } from '@/features/inbox/use-inbox';
import { useTrips } from '@/features/trips/trips-context';
import { formatDateRange } from '@/lib/dates';

function Lines({ lines }: { lines: { label: string; value: string }[] }) {
  const theme = useAppTheme();
  return (
    <Surface style={{ paddingVertical: space.xs }}>
      {lines.map((line, index) => (
        <View
          accessible
          accessibilityLabel={`${line.label}: ${line.value}`}
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
          <Text style={{ flex: 1, textAlign: 'right' }} tabular variant="secondary">
            {line.value}
          </Text>
        </View>
      ))}
    </Surface>
  );
}

function JobCardSummary({ id }: { id: string }) {
  const job = useQuery(staffApi.getJobCardDetail.ref, { jobCardId: id });
  if (job === undefined) {
    return (
      <Surface>
        <Placeholder lines={3} />
      </Surface>
    );
  }
  if (job === null) {
    return (
      <Surface>
        <QuietState text="This Job Card is not visible to you." />
      </Surface>
    );
  }
  return (
    <Lines
      lines={[
        { label: 'Job Card', value: job.jobCode },
        { label: 'Client', value: job.clientName },
        { label: 'Destination', value: job.destination || 'Not set' },
        { label: 'Dates', value: formatDateRange(job.travelStartDate, job.travelEndDate) },
        { label: 'Status', value: job.status },
      ]}
    />
  );
}

function ExpenseSummary({ id }: { id: string }) {
  const expense = useQuery(staffApi.getExpenseRow.ref, { expenseId: id });
  if (expense === undefined) {
    return (
      <Surface>
        <Placeholder lines={3} />
      </Surface>
    );
  }
  if (expense === null) {
    return (
      <Surface>
        <QuietState text="This expense is not visible to you." />
      </Surface>
    );
  }
  return (
    <Lines
      lines={[
        { label: 'Amount', value: formatMoney(expense.amount, expense.currency) },
        { label: 'Category', value: expense.category },
        { label: 'Job Card', value: expense.jobCode },
        { label: 'Approval', value: expense.approvalStatus },
        { label: 'Manager', value: expense.managerReviewStatus },
      ]}
    />
  );
}

/** A notification and a short summary of its record. Read-only; the portal holds the full record. */
export default function NotificationDetail() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { gate, online } = useStaffSession();
  const { rows } = useInbox();
  const { selectTrip, trips } = useTrips();
  const notification = rows.find((row) => row.id === id);
  if (!notification) {
    return (
      <Screen tabBar={false}>
        <Surface>
          <QuietState text="This notification is not on this phone. Open the inbox while online to refresh it." />
        </Surface>
      </Screen>
    );
  }
  const canQuery = online && gate.kind === 'staff' && !gate.offline && Boolean(notification.entityId);
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
      {!['jobCard', 'expense'].includes(notification.entityType) || !canQuery ? (
        <Text tone="muted" variant="secondary">
          Open Citius Connect on the web portal for the full record.
        </Text>
      ) : null}
    </Screen>
  );
}
