import type { ExpenseRow } from '@citius/backend';
import { Button, space, StatusPill, Surface, Text, type StatusKind, useAppTheme } from '@citius/ui';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, LayoutAnimationConfig } from 'react-native-reanimated';

import { Arrive, IconTile, ListCard, QuietState, Row, SectionTitle } from '@/components/kit';
import { formatDateRange } from '@/lib/dates';
import { CLOSE_UP, EASE_OUT, ROW_OUT } from '@/lib/motion';

import { formatMoney } from './format';
import type { OutboxItem } from './outbox';
import type { ServerExpenses } from './server-expenses';
import { SkeletonBlock, SkeletonLine } from './skeleton';

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

const ROW_IN = FadeInUp.duration(240).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 8 }] });
const PILL_IN = FadeIn.duration(150);

/** An expense still on this phone: sending, or stopped on a refusal. Sent ones leave the list. */
export interface PhoneExpense {
  item: OutboxItem;
  /** The trip's code when it is not the trip the tab is showing. */
  otherTrip: string | null;
}

function outboxStatus(item: OutboxItem): { kind: StatusKind; label: string } {
  if (item.status === 'done') return { kind: 'good', label: 'Sent' };
  if (item.status === 'needsAttention') return { kind: 'attention', label: 'Needs attention' };
  return { kind: 'neutral', label: item.stage === 'queued' ? 'Saved on phone' : 'Sending' };
}

function approvalPill(row: ExpenseRow): { kind: StatusKind; label: string } {
  if (!row.submittedForApprovalAt) return { kind: 'neutral', label: 'Draft' };
  if (row.approvalStatus === 'Approved') return { kind: 'good', label: 'Approved' };
  if (row.approvalStatus === 'Rejected') return { kind: 'attention', label: 'Rejected' };
  return { kind: 'neutral', label: row.approvalStatus || 'Pending' };
}

/**
 * Asks before deleting. Once the create reached the server there is a draft there, and the app has
 * no way to delete it, so the question says it stays on the portal.
 */
function confirmDiscard(item: OutboxItem, onDiscard: () => void) {
  const message = item.expenseId
    ? 'The receipt photo is removed from this phone. A draft of this expense is already on the Citius portal and stays there; delete it on the portal if it is not needed.'
    : 'The expense and its receipt photo are removed from this phone. Nothing was sent to the Citius portal.';
  Alert.alert('Delete this expense?', message, [
    { style: 'cancel', text: 'Cancel' },
    { onPress: onDiscard, style: 'destructive', text: 'Delete' },
  ]);
}

function Amount({ amount, currency }: { amount: number; currency: string }) {
  return (
    <Text style={{ textAlign: 'right' }} tabular variant="bodyStrong">
      {formatMoney(amount, currency)}
    </Text>
  );
}

/**
 * A status pill that crossfades when the expense moves on (Saved on phone, Sending): 150 ms, so the
 * change reads as progress rather than a flicker. Shows still when the screen opens.
 */
function SwapPill({ kind, label }: { kind: StatusKind; label: string }) {
  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.View entering={PILL_IN} key={label}>
        <StatusPill kind={kind} label={label} />
      </Animated.View>
    </LayoutAnimationConfig>
  );
}

function OutboxRow({ entry, last, onDiscard, onRetry }: { entry: PhoneExpense; last: boolean; onDiscard: () => void; onRetry: () => void }) {
  const theme = useAppTheme();
  const { item, otherTrip } = entry;
  const status = outboxStatus(item);
  const { amount, category, currency, expenseDate, particulars } = item.draft;
  const title = particulars || category;
  const date = formatDateRange(expenseDate, expenseDate);
  const subtitle = [otherTrip, particulars ? category : null, date].filter(Boolean).join(' · ');
  const attention = item.status === 'needsAttention';
  return (
    <View>
      <Row
        accessibilityLabel={[formatMoney(amount, currency), title, subtitle, status.label].filter(Boolean).join(', ')}
        detail={<SwapPill kind={status.kind} label={status.label} />}
        last={last || attention}
        leading={<IconTile icon={iconFor(category)} />}
        subtitle={subtitle}
        title={title}
        trailing={<Amount amount={amount} currency={currency} />}
      />
      {attention ? (
        <Surface style={{ gap: space.md, marginBottom: last ? space.md : 0 }} variant="inset">
          <Text variant="secondary">{item.problem}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Try again" onPress={onRetry} variant="secondary" />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Delete" onPress={() => confirmDiscard(item, onDiscard)} variant="secondary" />
            </View>
          </View>
        </Surface>
      ) : null}
      {attention && !last ? <View style={{ backgroundColor: theme.color.rule, height: 1, marginTop: space.md }} /> : null}
    </View>
  );
}

/**
 * Expenses on this phone that the office does not have yet, for every trip: one filed against
 * another trip, or one the server refused, never drops out of sight when Today's trip changes.
 */
export function OnThisPhone({
  entries,
  onDiscard,
  onRetry,
}: {
  entries: PhoneExpense[];
  onDiscard: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <View style={{ gap: space.md }}>
      <SectionTitle>On this phone</SectionTitle>
      <ListCard>
        {entries.map((entry, index) => (
          // A new expense rises 8pt into the list when it lands after saving; one that is sent
          // fades out and the rows below close the gap (the list was open as it changed).
          <Animated.View entering={ROW_IN} exiting={ROW_OUT} key={entry.item.id} layout={CLOSE_UP}>
            <OutboxRow
              entry={entry}
              last={index === entries.length - 1}
              onDiscard={() => onDiscard(entry.item.id)}
              onRetry={() => onRetry(entry.item.id)}
            />
          </Animated.View>
        ))}
      </ListCard>
    </View>
  );
}

/** An expense the server holds, with where it is in approval. */
function SubmittedRow({ last, row }: { last: boolean; row: ExpenseRow }) {
  const pill = approvalPill(row);
  const title = row.particulars || row.category;
  const day = row.expenseDate || row.createdAt.slice(0, 10);
  const date = formatDateRange(day, day);
  return (
    <Row
      accessibilityLabel={[formatMoney(row.amount, row.currency), title, row.particulars ? row.category : null, date, pill.label].filter(Boolean).join(', ')}
      detail={<StatusPill kind={pill.kind} label={pill.label} />}
      last={last}
      leading={<IconTile icon={iconFor(row.category)} />}
      subtitle={[row.particulars ? row.category : null, date].filter(Boolean).join(' · ')}
      title={title}
      trailing={<Amount amount={row.amount} currency={row.currency} />}
    />
  );
}

const SKELETON_ROWS = 3;
/** StatusPill's own minimum height. */
const PILL_HEIGHT = 26;

/**
 * Three submitted rows while the list loads, built on the Row's own frame: icon tile, title,
 * subtitle and approval pill at their real sizes, so the rows land where the bars were.
 */
function SubmittedSkeleton() {
  const theme = useAppTheme();
  return (
    <View accessibilityLabel="Loading" accessible>
      <ListCard>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <View
            key={index}
            style={[
              styles.skeletonRow,
              { borderBottomColor: theme.color.rule, borderBottomWidth: index === SKELETON_ROWS - 1 ? 0 : StyleSheet.hairlineWidth },
            ]}
          >
            <SkeletonBlock style={{ borderRadius: 11, height: 36, width: 36 }} />
            <View style={styles.skeletonText}>
              <SkeletonLine variant="rowTitle" width="70%" />
              <SkeletonLine variant="secondary" width="45%" />
              <View style={{ paddingTop: space.xs }}>
                <SkeletonBlock style={{ borderRadius: theme.radius.chip, height: PILL_HEIGHT, width: 84 }} />
              </View>
            </View>
            <SkeletonLine variant="bodyStrong" width={72} />
          </View>
        ))}
      </ListCard>
    </View>
  );
}

/** What the server holds for this trip, or why it cannot be shown yet. */
export function SubmittedList({ hasLocal, server, submitted }: { hasLocal: boolean; server: ServerExpenses; submitted: ExpenseRow[] }) {
  switch (server.kind) {
    case 'noTrip':
      return (
        <Surface>
          <QuietState text="No trips yet. Expenses show here once Operations assigns you a trip." />
        </Surface>
      );
    case 'offline':
      return (
        <Surface>
          <QuietState text="Connect to the internet to see expenses already on the server." />
        </Surface>
      );
    case 'loading':
      return <SubmittedSkeleton />;
    case 'loaded':
      return (
        <Arrive gap={space.lg + 4}>
          {server.complete && submitted.length === 0 ? (
            <Surface>
              <QuietState text={hasLocal ? 'Nothing else submitted for this trip yet.' : 'No expenses on this trip yet.'} />
            </Surface>
          ) : null}
          {submitted.length > 0 ? (
            <ListCard>
              {submitted.map((row, index) => (
                <SubmittedRow key={row.id} last={index === submitted.length - 1} row={row} />
              ))}
            </ListCard>
          ) : null}
          {server.complete ? null : (
            <Text tone="muted" variant="secondary">
              More expenses for this trip are on the server than are shown here. Check the full list on the Citius portal.
            </Text>
          )}
        </Arrive>
      );
  }
}

const styles = StyleSheet.create({
  // The kit Row's frame: same padding, gap and 60pt minimum.
  skeletonRow: { alignItems: 'center', flexDirection: 'row', gap: space.md, minHeight: 60, paddingVertical: space.md },
  skeletonText: { flex: 1, gap: 2 },
});
