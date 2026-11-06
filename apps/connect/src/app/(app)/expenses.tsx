import { type ExpenseRow, staffApi } from '@citius/backend';
import { Button, citius, StatusPill, type StatusKind, space, Surface, Text, useAppTheme } from '@citius/ui';
import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { formatDateRange, Icon, IconTile, ListCard, Placeholder, QuietState, Row, Screen, SectionTitle } from '@/components/kit';
import { formatMoney } from '@/features/expenses/format';
import type { OutboxItem } from '@/features/expenses/outbox';
import { useOutbox } from '@/features/expenses/outbox-context';
import { categorySplit, formatAmount, type SpendEntry, spendEntries, totalsByCurrency } from '@/features/expenses/totals';
import { useStaffSession } from '@/features/gate/session';
import { useTrips } from '@/features/trips/trips-context';

const PAGE_SIZE = 50;

const CATEGORY_ICONS: Record<string, { ios: string; md: string }> = {
  Activity: { ios: 'ticket', md: 'local_activity' },
  'F&B': { ios: 'fork.knife', md: 'restaurant' },
  Hotel: { ios: 'bed.double', md: 'hotel' },
  Miscellaneous: { ios: 'square.grid.2x2', md: 'category' },
  Tips: { ios: 'banknote', md: 'payments' },
  Transport: { ios: 'car', md: 'directions_car' },
  Visa: { ios: 'person.text.rectangle', md: 'badge' },
};
const iconFor = (category: string) => CATEGORY_ICONS[category] ?? { ios: 'creditcard', md: 'receipt_long' };

/** Category segments are data: the Citius data colours, then lighter repeats, always with a legend. */
const SEGMENTS = [
  { color: citius.blue, opacity: 1 },
  { color: citius.orange, opacity: 1 },
  { color: citius.green, opacity: 1 },
  { color: citius.lime, opacity: 1 },
  { color: citius.blue, opacity: 0.45 },
  { color: citius.orange, opacity: 0.45 },
  { color: citius.green, opacity: 0.45 },
  { color: citius.muted, opacity: 0.5 },
];
const segment = (index: number) => SEGMENTS[index] ?? SEGMENTS[SEGMENTS.length - 1]!;

function outboxStatus(item: OutboxItem): { kind: StatusKind; label: string } {
  if (item.status === 'done') return { kind: 'good', label: 'Sent' };
  if (item.status === 'needsAttention') return { kind: 'attention', label: 'Needs attention' };
  return { kind: 'neutral', label: item.stage === 'queued' ? 'Queued' : 'Sending' };
}

function approvalPill(row: ExpenseRow): { kind: StatusKind; label: string } {
  if (!row.submittedForApprovalAt) return { kind: 'neutral', label: 'Draft' };
  if (row.approvalStatus === 'Approved') return { kind: 'good', label: 'Approved' };
  if (row.approvalStatus === 'Rejected') return { kind: 'attention', label: 'Rejected' };
  return { kind: 'neutral', label: row.approvalStatus || 'Pending' };
}

function Amount({ amount, currency }: { amount: number; currency: string }) {
  return (
    <Text style={{ textAlign: 'right' }} tabular variant="bodyStrong">
      {formatMoney(amount, currency)}
    </Text>
  );
}

/** "What have I spent?" The total per currency, then how the main one splits by category. */
function SpendCard({ entries, label, loading, partial }: { entries: SpendEntry[]; label: string; loading: boolean; partial: boolean }) {
  const theme = useAppTheme();
  const totals = totalsByCurrency(entries);
  const [main, ...others] = totals;
  const split = main ? categorySplit(entries, main.currency) : [];
  return (
    <Surface style={{ gap: space.lg }} variant="hero">
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label">{label}</Text>
        <Icon color={theme.color.muted} ios="creditcard" md="account_balance_wallet" size={18} />
      </View>
      {loading ? <Placeholder lines={2} /> : null}
      {!loading && !main ? (
        <Text tone="muted" variant="section">
          Nothing spent yet
        </Text>
      ) : null}
      {!loading && main ? (
        <View
          accessible
          accessibilityLabel={`${label}: ${totals.map((total) => formatMoney(total.total, total.currency)).join(', ')}`}
          style={{ gap: space.sm }}
        >
          <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 6 }}>
            <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={{ flexShrink: 1 }} tabular variant="answer">
              {formatAmount(main.total, main.currency)}
            </Text>
            <Text style={{ fontFamily: theme.font.medium }} tone="muted" variant="rowTitle">
              {main.currency}
            </Text>
          </View>
          {others.map((total) => (
            <View key={total.currency} style={{ alignItems: 'baseline', flexDirection: 'row', gap: 6 }}>
              <Text tabular variant="bodyStrong">
                {formatAmount(total.total, total.currency)}
              </Text>
              <Text tone="muted" variant="secondary">
                {total.currency} · {total.count} {total.count === 1 ? 'expense' : 'expenses'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {!loading && main && split.length > 0 ? (
        <View
          accessible
          accessibilityLabel={`${main.currency} by category: ${split.map((part) => `${part.category} ${Math.round(part.share * 100)} percent`).join(', ')}`}
          style={{ gap: space.md }}
        >
          {others.length > 0 ? (
            <Text tone="muted" variant="label">
              {main.currency} by category
            </Text>
          ) : null}
          <View style={{ borderRadius: 4, flexDirection: 'row', gap: 2, height: 8, overflow: 'hidden' }}>
            {split.map((part, index) => (
              <View
                key={part.category}
                style={{ backgroundColor: segment(index).color, flexGrow: part.share, minWidth: 4, opacity: segment(index).opacity }}
              />
            ))}
          </View>
          <View style={{ columnGap: space.lg, flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm }}>
            {split.map((part, index) => (
              <View key={part.category} style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
                <View style={{ backgroundColor: segment(index).color, borderRadius: 4, height: 8, opacity: segment(index).opacity, width: 8 }} />
                <Text variant="label">{part.category}</Text>
                <Text tabular tone="muted" variant="label">
                  {Math.max(1, Math.round(part.share * 100))}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {partial ? (
        <Text tone="muted" variant="secondary">
          Counts the first {PAGE_SIZE} expenses on the server only.
        </Text>
      ) : null}
      <Button
        icon={<Icon color={theme.color.onPrimary} ios="plus" md="add" size={16} />}
        label="Add expense"
        onPress={() => router.push('/expense-new')}
      />
    </Surface>
  );
}

function OutboxRow({ item, last, onDiscard, onRetry }: { item: OutboxItem; last: boolean; onDiscard: () => void; onRetry: () => void }) {
  const theme = useAppTheme();
  const status = outboxStatus(item);
  const { amount, category, currency, expenseDate, particulars } = item.draft;
  const title = particulars || category;
  const date = formatDateRange(expenseDate, expenseDate);
  const attention = item.status === 'needsAttention';
  return (
    <View>
      <Row
        accessibilityLabel={[formatMoney(amount, currency), title, particulars ? category : null, date, status.label].filter(Boolean).join(', ')}
        detail={<StatusPill kind={status.kind} label={status.label} />}
        last={last || attention}
        leading={<IconTile icon={iconFor(category)} />}
        subtitle={[particulars ? category : null, date].filter(Boolean).join(' · ')}
        title={title}
        trailing={<Amount amount={amount} currency={currency} />}
      />
      {attention ? (
        <Surface
          style={{ gap: space.md, marginBottom: last ? space.md : 0 }}
          variant="inset"
        >
          <Text variant="secondary">{item.problem}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Try again" onPress={onRetry} variant="secondary" />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Delete" onPress={onDiscard} variant="secondary" />
            </View>
          </View>
        </Surface>
      ) : null}
      {attention && !last ? <View style={{ backgroundColor: theme.color.rule, height: 1, marginTop: space.md }} /> : null}
    </View>
  );
}

/** "What have I spent and has it been sent?" */
export default function Expenses() {
  const { gate, online } = useStaffSession();
  const { discard, items, retry } = useOutbox();
  const { selected } = useTrips();
  const canQuery = online && gate.kind === 'staff' && !gate.offline && Boolean(selected);
  const server = useQuery(
    staffApi.listExpenses.ref,
    canQuery && selected ? { jobCardId: selected.id, paginationOpts: { cursor: null, numItems: PAGE_SIZE } } : 'skip'
  );
  const mine = items.filter((item) => !selected || item.jobCardId === selected.id);
  const serverRows = canQuery && server ? server.page : null;
  const entries = spendEntries(mine, serverRows);
  return (
    <Screen kicker={selected?.jobCode} title="Expenses">
      <SpendCard
        entries={entries}
        label={serverRows ? 'Spent on this trip' : 'Saved on this phone'}
        loading={canQuery && server === undefined}
        partial={Boolean(serverRows && server && !server.isDone)}
      />
      {mine.length > 0 ? (
        <View style={{ gap: space.md }}>
          <SectionTitle>On this phone</SectionTitle>
          <ListCard>
            {mine.map((item, index) => (
              <OutboxRow
                item={item}
                key={item.id}
                last={index === mine.length - 1}
                onDiscard={() => discard(item.id)}
                onRetry={() => retry(item.id)}
              />
            ))}
          </ListCard>
        </View>
      ) : null}
      <View style={{ gap: space.md }}>
        <SectionTitle>Submitted for this trip</SectionTitle>
        {!canQuery ? (
          <Surface>
            <QuietState text="Connect to the internet to see expenses already on the server." />
          </Surface>
        ) : null}
        {canQuery && server === undefined ? (
          <Surface>
            <Placeholder lines={3} />
          </Surface>
        ) : null}
        {canQuery && server && server.isDone && server.page.length === 0 ? (
          <Surface>
            <QuietState text="No expenses on this trip yet." />
          </Surface>
        ) : null}
        {canQuery && server && server.page.length > 0 ? (
          <ListCard>
            {server.page.map((row, index) => {
              const pill = approvalPill(row);
              const title = row.particulars || row.category;
              const day = row.expenseDate || row.createdAt.slice(0, 10);
              const date = formatDateRange(day, day);
              return (
                <Row
                  accessibilityLabel={[formatMoney(row.amount, row.currency), title, row.particulars ? row.category : null, date, pill.label].filter(Boolean).join(', ')}
                  detail={<StatusPill kind={pill.kind} label={pill.label} />}
                  key={row.id}
                  last={index === server.page.length - 1}
                  leading={<IconTile icon={iconFor(row.category)} />}
                  subtitle={[row.particulars ? row.category : null, date].filter(Boolean).join(' · ')}
                  title={title}
                  trailing={<Amount amount={row.amount} currency={row.currency} />}
                />
              );
            })}
          </ListCard>
        ) : null}
        {canQuery && server && !server.isDone ? (
          <Text tone="muted" variant="secondary">
            More expenses for this trip are on the server than are shown here. Check the full list on the Citius portal.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
