import { space, StatusPill, Text, useAppTheme } from '@citius/ui';
import { tripSchedule } from '@citius/core/src/schedule';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PageTitle, Screen } from '@/components/kit';
import { PlanSkeleton } from '@/components/skeletons';
import { tripDates } from '@/features/trips/labels';
import { dayNumber } from '@/features/trips/model';
import { useTrip } from '@/features/trips/use-trips';
import { useI18n } from '@/i18n/i18n';
import { useNow } from '@/lib/use-now';

/**
 * The whole programme as a timeline: one stop per day, today marked in orange, past days muted.
 * The text is Citius's own itinerary, shown as written (it is not translated).
 */
export default function PlanScreen() {
  const theme = useAppTheme();
  const i18n = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const now = useNow();
  const detail = trip.data;
  if (!detail) {
    return (
      <Screen contentInsetAdjustmentBehavior="automatic" tabBar={false}>
        <PlanSkeleton label={i18n.t('common.loading')} />
      </Screen>
    );
  }
  const { steps, summary } = tripSchedule(detail.plan?.content ?? '', detail.trip.travelStartDate ?? '', detail.trip.travelEndDate ?? '', now);
  return (
    <Screen contentInsetAdjustmentBehavior="automatic" tabBar={false}>
      <PageTitle kicker={detail.trip.groupName} meta={tripDates(i18n, detail.trip)} title={detail.plan?.title || detail.trip.destination} />
      {!detail.plan?.content.trim() ? <Text tone="muted">{i18n.t('trip.planEmpty')}</Text> : null}
      {summary ? <Text>{summary}</Text> : null}
      <View>
        {steps.map((step, index) => {
          const current = step.state === 'current';
          const done = step.state === 'done';
          const last = index === steps.length - 1;
          return (
            <View accessible key={step.key} style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ alignItems: 'center', width: 28 }}>
                <View
                  style={{
                    backgroundColor: current ? '#f58220' : done ? theme.color.tickOff : theme.color.surface,
                    borderColor: current ? '#f58220' : done ? theme.color.tickOff : theme.color.primary,
                    borderRadius: 14,
                    borderWidth: 2,
                    height: 28,
                    justifyContent: 'center',
                    marginTop: 2,
                    width: 28,
                  }}
                >
                  <Text style={{ textAlign: 'center' }} tone={current ? 'onPrimary' : done ? 'muted' : 'primary'} variant="label">
                    {dayNumber(step.dayLabel) ?? '•'}
                  </Text>
                </View>
                {last ? null : <View style={{ backgroundColor: theme.color.border, flex: 1, marginVertical: 4, width: StyleSheet.hairlineWidth * 2 }} />}
              </View>
              <View style={{ flex: 1, gap: space.xs, paddingBottom: last ? 0 : space.xl }}>
                <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  <Text tone={done ? 'muted' : 'ink'} variant="bodyStrong">
                    {dayNumber(step.dayLabel) ? i18n.t('plan.day', { day: dayNumber(step.dayLabel) ?? '' }) : ''}
                    {step.date ? ` · ${i18n.weekday(step.date)}` : ''}
                  </Text>
                  {current ? <StatusPill kind="live" label={i18n.t('trip.today')} /> : null}
                </View>
                {step.text ? <Text tone={done ? 'muted' : 'ink'}>{step.text}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
