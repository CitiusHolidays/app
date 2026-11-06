import { staffApi } from '@citius/backend';
import { Button, StatusPill, space, Text } from '@citius/ui';
import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Row, Screen, SectionTitle } from '@/components/kit';
import { formatMoney } from '@/features/expenses/format';
import type { OutboxItem } from '@/features/expenses/outbox';
import { useOutbox } from '@/features/expenses/outbox-context';
import { useStaffSession } from '@/features/gate/session';
import { useTrips } from '@/features/trips/trips-context';

function outboxStatus(item: OutboxItem) {
  if (item.status === 'done') return { kind: 'good' as const, label: 'Sent for approval' };
  if (item.status === 'needsAttention') return { kind: 'attention' as const, label: 'Needs attention' };
  return { kind: 'neutral' as const, label: item.stage === 'queued' ? 'Waiting to send' : 'Sending' };
}

export default function Expenses() {
  const { gate, online } = useStaffSession();
  const { discard, items, retry } = useOutbox();
  const { selected } = useTrips();
  const canQuery = online && gate.kind === 'staff' && !gate.offline && Boolean(selected);
  const server = useQuery(
    staffApi.listExpenses.ref,
    canQuery && selected ? { jobCardId: selected.id, paginationOpts: { cursor: null, numItems: 50 } } : 'skip'
  );
  const mine = items.filter((item) => !selected || item.jobCardId === selected.id);
  return (
    <Screen title="Expenses">
      <Button label="Add expense with receipt" onPress={() => router.push('/expense-new')} />
      {mine.length > 0 ? <SectionTitle>On this phone</SectionTitle> : null}
      {mine.map((item) => {
        const status = outboxStatus(item);
        return (
          <View key={item.id} style={{ gap: space.xs }}>
            <Row
              subtitle={`${item.draft.category} · ${item.draft.expenseDate}${item.draft.particulars ? ` · ${item.draft.particulars}` : ''}`}
              title={formatMoney(item.draft.amount, item.draft.currency)}
              trailing={<StatusPill kind={status.kind} label={status.label} />}
            />
            {item.status === 'needsAttention' ? (
              <View style={{ gap: space.sm }}>
                <Text variant="secondary">{item.problem}</Text>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button label="Try again" onPress={() => retry(item.id)} variant="secondary" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="Delete" onPress={() => discard(item.id)} variant="secondary" />
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
      <SectionTitle>Submitted for this trip</SectionTitle>
      {!canQuery ? <Text tone="muted">Connect to the internet to see expenses already on the server.</Text> : null}
      {canQuery && server === undefined ? <Text tone="muted">Loading…</Text> : null}
      {server && server.page.length === 0 ? <Text tone="muted">No expenses on this trip yet.</Text> : null}
      {server?.page.map((row) => (
        <Row
          key={row.id}
          subtitle={`${row.category} · ${row.expenseDate || row.createdAt.slice(0, 10)}`}
          title={formatMoney(row.amount, row.currency)}
          trailing={
            <StatusPill
              kind={row.approvalStatus === 'Approved' ? 'good' : row.approvalStatus === 'Rejected' ? 'attention' : 'neutral'}
              label={row.submittedForApprovalAt ? row.approvalStatus : 'Draft'}
            />
          }
        />
      ))}
    </Screen>
  );
}
