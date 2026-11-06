import { staffApi } from '@citius/backend';
import { space, Surface, Text } from '@citius/ui';
import { useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { formatDateRange, Placeholder, Screen, SectionTitle } from '@/components/kit';
import { formatMoney } from '@/features/expenses/format';
import { useStaffSession } from '@/features/gate/session';
import { useInbox } from '@/features/inbox/use-inbox';

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: 'row', gap: space.sm }}>
      <Text variant="secondary" style={{ width: 110 }} tone="muted">
        {label}
      </Text>
      <Text variant="secondary" style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}

function JobCardSummary({ id }: { id: string }) {
  const job = useQuery(staffApi.getJobCardDetail.ref, { jobCardId: id });
  if (job === undefined) return <Placeholder lines={3} />;
  if (job === null) return <Text tone="muted">This Job Card is not visible to you.</Text>;
  return (
    <Surface style={{ gap: space.xs }}>
      <Line label="Job Card" value={job.jobCode} />
      <Line label="Client" value={job.clientName} />
      <Line label="Destination" value={job.destination || 'Not set'} />
      <Line label="Dates" value={formatDateRange(job.travelStartDate, job.travelEndDate)} />
      <Line label="Status" value={job.status} />
    </Surface>
  );
}

function ExpenseSummary({ id }: { id: string }) {
  const expense = useQuery(staffApi.getExpenseRow.ref, { expenseId: id });
  if (expense === undefined) return <Placeholder lines={3} />;
  if (expense === null) return <Text tone="muted">This expense is not visible to you.</Text>;
  return (
    <Surface style={{ gap: space.xs }}>
      <Line label="Amount" value={formatMoney(expense.amount, expense.currency)} />
      <Line label="Category" value={expense.category} />
      <Line label="Job Card" value={expense.jobCode} />
      <Line label="Approval" value={expense.approvalStatus} />
      <Line label="Manager" value={expense.managerReviewStatus} />
    </Surface>
  );
}

/** A notification and a short summary of its record. Read-only; the portal holds the full record. */
export default function NotificationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { gate, online } = useStaffSession();
  const { rows } = useInbox();
  const notification = rows.find((row) => row.id === id);
  if (!notification) {
    return (
      <Screen>
        <Text tone="muted">This notification is not on this phone. Open the inbox while online to refresh it.</Text>
      </Screen>
    );
  }
  const canQuery = online && gate.kind === 'staff' && !gate.offline && Boolean(notification.entityId);
  return (
    <Screen>
      <Text accessibilityRole="header" variant="section">
        {notification.title}
      </Text>
      <Text selectable>{notification.body}</Text>
      <Text variant="meta" tone="muted">
        {new Date(notification.createdAt).toLocaleString()}
      </Text>
      {canQuery && notification.entityType === 'jobCard' ? (
        <>
          <SectionTitle>Job Card</SectionTitle>
          <JobCardSummary id={notification.entityId} />
        </>
      ) : null}
      {canQuery && notification.entityType === 'expense' ? (
        <>
          <SectionTitle>Expense</SectionTitle>
          <ExpenseSummary id={notification.entityId} />
        </>
      ) : null}
      {!['jobCard', 'expense'].includes(notification.entityType) || !canQuery ? (
        <Text variant="secondary" tone="muted">
          Open Citius Connect on the web portal for the full record.
        </Text>
      ) : null}
    </Screen>
  );
}
