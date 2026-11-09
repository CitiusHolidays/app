import { Button, citius, face, space, Surface, Text, useAppTheme } from '@citius/ui';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon } from '@/components/kit';

import { formatMoney } from './format';
import { SERVER_PAGE_SIZE } from './server-expenses';
import { SkeletonBlock, SkeletonLine } from './skeleton';
import { categorySplit, formatAmount, type SpendEntry, totalsByCurrency } from './totals';

/** Every category past the named colours shares this one. */
const LAST_SEGMENT = { color: citius.muted, opacity: 0.5 };
/** Category segments are data: the Citius data colours, then lighter repeats, always with a legend. */
const SEGMENTS = [
  { color: citius.blue, opacity: 1 },
  { color: citius.orange, opacity: 1 },
  { color: citius.green, opacity: 1 },
  { color: citius.lime, opacity: 1 },
  { color: citius.blue, opacity: 0.45 },
  { color: citius.orange, opacity: 0.45 },
  { color: citius.green, opacity: 0.45 },
  LAST_SEGMENT,
];
const segment = (index: number) => SEGMENTS[index] ?? LAST_SEGMENT;
const SPLIT_BAR = { borderRadius: 4, flexDirection: 'row', gap: 2, height: 8, overflow: 'hidden' } as const;

/**
 * Stands in for the total and the category split while the server list loads, line for line: the
 * big figure, the split bar, then one row of legend. It fills the same two slots of the card.
 */
function SpendSkeleton() {
  return (
    <View accessibilityLabel="Loading" accessible style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <SkeletonLine variant="answer" width="55%" />
      </View>
      <View style={{ gap: space.md }}>
        <SkeletonBlock style={SPLIT_BAR} />
        <View style={{ columnGap: space.lg, flexDirection: 'row' }}>
          <SkeletonLine variant="label" width={88} />
          <SkeletonLine variant="label" width={72} />
          <SkeletonLine variant="label" width={64} />
        </View>
      </View>
    </View>
  );
}

/** "What have I spent?" The total per currency, then how the main one splits by category. */
export function SpendCard({ entries, label, loading, partial }: { entries: SpendEntry[]; label: string; loading: boolean; partial: boolean }) {
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
      {loading ? <SpendSkeleton /> : null}
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
            <Text style={face(theme, 'medium')} tone="muted" variant="rowTitle">
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
          <View style={SPLIT_BAR}>
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
          Counts the first {SERVER_PAGE_SIZE} expenses on the server only.
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
