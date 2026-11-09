import { customerApi, type ConsentState, PARENTAL_CONSENT_TEXT_VERSION, type TripDetail, type TripSummary } from '@citius/backend/customer';
import { Banner, Button, citius, space, StatusPill, Surface, Text, useAppTheme } from '@citius/ui';
import { tripSchedule } from '@citius/core';
import { useMutation } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, ListCard, Row, SectionTitle } from '@/components/kit';
import { TripHeroSkeleton, TripSheetSkeleton } from '@/components/skeletons';
import { DESTINATION_TYPE } from '@/components/destination-type';
import { DestinationCover } from '@/components/destination-cover';
import { Freshness } from '@/components/trip-cards';
import { AnnouncementItem, ContactRow, DocumentsCard } from '@/components/trip-sections';
import { NotSaved, TripUnavailable } from '@/components/trip-states';
import { RoundBackButton } from '@/components/round-button';
import { useCustomerSession } from '@/features/session/session';
import { CITIUS_EMAIL } from '@/features/support/contacts';
import { datesAndNights, timingText } from '@/features/trips/labels';
import { dayNumber, tripStage } from '@/features/trips/model';
import { useTrip, useTrips } from '@/features/trips/use-trips';
import { useI18n } from '@/i18n/i18n';
import type { MessageKey } from '@/i18n/locales/en';
import { EASE_OUT } from '@/components/motion';
import { haptic } from '@/lib/haptic';
import { openUrl } from '@/lib/open-url';
import { runThen } from '@/lib/run-then';
import { logEvent } from '@/lib/safe-log';
import { useNow } from '@/lib/use-now';
import { usePullRefresh } from '@/lib/use-pull-refresh';

export { ScreenError as ErrorBoundary } from '@/components/error-boundary';

/** The photo's arrival from the Journeys card: short, so the header is still before a tap lands. */
const PHOTO_SETTLE_MS = 280;

/** The traveller's own line under the title: their name, group code and children, as chips. */
function yourChips(i18n: ReturnType<typeof useI18n>, trip: TripSummary, detail: TripDetail | undefined) {
  const name = detail ? detail.me?.fullName : trip.travellerName;
  const minors = detail ? detail.minors.length : trip.minorCount;
  // The group code comes only with the detail, so it goes last: arriving, it joins the row
  // without moving the chips already there.
  return [
    name ? i18n.t('trip.you', { name }) : null,
    minors ? i18n.tn('journeys.withChildren', minors) : null,
    detail?.me?.groupCode ? i18n.t('trip.group', { code: detail.me.groupCode }) : null,
  ].filter((item): item is string => Boolean(item));
}

/**
 * The destination edge to edge, with the trip's name, dates, timing and the traveller's own line.
 * It needs only what the trip list already holds, so it draws at once while the detail loads.
 */
function TripHeader({ chips, now, scrollY, trip }: { chips: string[]; now: number; scrollY: SharedValue<number>; trip: TripSummary }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const heroHeight = insets.top + 470;
  // The photo stays pinned and stretches when pulled down (iOS), and drifts at half speed as the
  // page scrolls up, so the sheet slides over it. Transform only, on the UI thread.
  // Continuity from the Journeys card: the same photo arrives a touch closer, as the card was, and
  // settles back while the push lands (once).
  const settle = useSharedValue(reduced ? 0 : 1);
  useEffect(() => {
    settle.set(withTiming(0, { duration: PHOTO_SETTLE_MS, easing: EASE_OUT }));
  }, [settle]);
  const photoStyle = useAnimatedStyle(() => {
    if (reduced) return { transform: [] };
    const y = scrollY.get();
    const arrive = 1 + settle.get() * 0.06;
    if (y < 0) return { transform: [{ translateY: y / 2 }, { scale: (1 - y / heroHeight) * arrive }] };
    return { transform: [{ translateY: Math.min(y, heroHeight) * 0.45 }, { scale: arrive }] };
  });
  const i18n = useI18n();
  const { phase, timing } = tripStage(trip, now);
  return (
    <View style={{ backgroundColor: theme.color.dark, minHeight: heroHeight }}>
      <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
        <DestinationCover photo={trip.cover} priority="high" scrim="full" />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingBottom: space.xxl + space.xl, paddingHorizontal: theme.frame, paddingTop: insets.top + space.sm }}>
        <RoundBackButton />
        <View style={{ gap: space.sm }}>
          <View
            style={{
              alignItems: 'center',
              alignSelf: 'flex-start',
              backgroundColor: 'rgba(255,255,255,0.94)',
              borderRadius: theme.radius.chip,
              flexDirection: 'row',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <View style={{ backgroundColor: phase === 'ongoing' ? citius.orange : theme.color.warning, borderRadius: 4, height: 8, width: 8 }} />
            <Text style={{ color: theme.color.warning }} variant="label">
              {timingText(i18n, timing)}
            </Text>
          </View>
          <View accessible accessibilityRole="header" style={{ gap: space.xs }}>
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.78)' }} variant="secondary">
              {trip.groupName}
            </Text>
            <Text style={DESTINATION_TYPE.hero} tone="onDark" variant="display">
              {trip.destination}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{datesAndNights(i18n, trip)}</Text>
          </View>
          {chips.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.xs }}>
              {chips.map((item) => (
                <View
                  key={item}
                  style={{
                    backgroundColor: 'rgba(11,16,38,0.45)',
                    borderColor: 'rgba(255,255,255,0.35)',
                    borderRadius: theme.radius.chip,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                  }}
                >
                  <Text tone="onDark" variant="label">
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function TodayCard({ detail, now }: { detail: TripDetail; now: number }) {
  const theme = useAppTheme();
  const { t, weekday } = useI18n();
  const { steps } = tripSchedule(detail.plan?.content ?? '', detail.trip.travelStartDate ?? '', detail.trip.travelEndDate ?? '', now);
  const today = steps.find((step) => step.state === 'current');
  const next = steps.find((step) => step.state === 'upcoming');
  const todayNumber = today ? dayNumber(today.dayLabel) : null;
  const nextNumber = next ? dayNumber(next.dayLabel) : null;
  return (
    <Surface variant="hero" style={{ borderColor: theme.color.primary, borderWidth: 1.5, gap: space.sm }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.sm }}>
        <View style={{ backgroundColor: citius.orange, borderRadius: 5, height: 10, width: 10 }} />
        <Text accessibilityRole="header" tone="warning" variant="bodyStrong">
          {t('trip.today')}
          {today?.date ? ` · ${weekday(today.date)}` : ''}
        </Text>
      </View>
      {today ? (
        <>
          {todayNumber ? <Text variant="section">{t('plan.day', { day: todayNumber })}</Text> : null}
          <Text>{today.text || t('trip.todayNothing')}</Text>
        </>
      ) : (
        <Text tone="muted">{t('trip.todayNothing')}</Text>
      )}
      {next?.text ? (
        <Text numberOfLines={2} tone="muted" variant="secondary">
          {nextNumber ? `${t('plan.day', { day: nextNumber })}: ` : ''}
          {next.text}
        </Text>
      ) : null}
    </Surface>
  );
}

/** The next few days of the programme, with a link to the whole plan. */
function PlanPreview({ detail, now, tripId }: { detail: TripDetail; now: number; tripId: string }) {
  const theme = useAppTheme();
  const { date, t } = useI18n();
  if (!detail.plan?.content.trim()) {
    return (
      <Surface>
        <SectionTitle>{t('trip.plan')}</SectionTitle>
        <Text style={{ paddingTop: space.sm }} tone="muted">
          {t('trip.planEmpty')}
        </Text>
      </Surface>
    );
  }
  const { steps } = tripSchedule(detail.plan.content, detail.trip.travelStartDate ?? '', detail.trip.travelEndDate ?? '', now);
  const firstOpen = Math.max(0, steps.findIndex((step) => step.state === 'current' || step.state === 'upcoming'));
  const shown = (tripStage(detail.trip, now).phase === 'past' ? steps : steps.slice(firstOpen)).slice(0, 3);
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle action={{ label: t('trip.planFull'), onPress: () => router.push({ params: { id: tripId }, pathname: '/trip/[id]/plan' }) }}>
        {t('trip.plan')}
      </SectionTitle>
      <ListCard>
        {shown.map((step, index) => (
          <View
            key={step.key}
            style={{
              borderBottomColor: theme.color.rule,
              borderBottomWidth: index === shown.length - 1 ? 0 : StyleSheet.hairlineWidth,
              flexDirection: 'row',
              gap: space.md,
              paddingVertical: space.md,
            }}
          >
            <View style={{ alignItems: 'center', width: 56 }}>
              <Text tone={step.state === 'current' ? 'warning' : 'primary'} variant="bodyStrong">
                {dayNumber(step.dayLabel) ?? '•'}
              </Text>
              {step.date ? (
                <Text tone="muted" variant="label">
                  {date(step.date)}
                </Text>
              ) : null}
            </View>
            <Text numberOfLines={3} style={{ flex: 1 }}>
              {step.text}
            </Text>
          </View>
        ))}
      </ListCard>
      <Text tone="muted" variant="label">
        {t('trip.planUpdated', { date: date(detail.plan.updatedAt, true), version: detail.plan.version })}
      </Text>
    </View>
  );
}

const CONSENT_LABEL: Record<ConsentState, MessageKey> = {
  granted: 'trip.consentGiven',
  none: 'trip.consentNone',
  withdrawn: 'trip.consentWithdrawn',
};

/** The children the traveller guards, with their own consent and a way to give or withdraw it. */
function FamilyCard({ detail, tripId }: { detail: TripDetail; tripId: string }) {
  const { t } = useI18n();
  const setConsent = useMutation(customerApi.setParentalConsent.ref);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState(false);
  const change = async (minor: TripDetail['minors'][number], action: 'granted' | 'withdrawn') => {
    setBusy(minor.travellerId);
    setProblem(false);
    try {
      await runThen(
        () => setConsent({ action, minorTravellerId: minor.travellerId, textVersion: PARENTAL_CONSENT_TEXT_VERSION, tripId }),
        () => setBusy(null)
      );
      haptic('success');
    } catch (error) {
      logEvent('trip.consent-failed', error);
      setProblem(true);
    }
  };
  // Consent is recorded against the wording the traveller saw, so both directions show it first:
  // giving shows the same statement the invite asks them to tick.
  const ask = (minor: TripDetail['minors'][number]) => {
    const name = minor.fullName.split(' ')[0] ?? minor.fullName;
    if (minor.consent === 'granted') {
      Alert.alert(t('trip.withdrawTitle', { name }), t('trip.withdrawBody', { name }), [
        { style: 'cancel', text: t('common.cancel') },
        { onPress: () => void change(minor, 'withdrawn'), style: 'destructive', text: t('trip.withdrawConsent') },
      ]);
    } else {
      Alert.alert(t('trip.giveTitle', { name }), t('invite.consentLabel', { name }), [
        { style: 'cancel', text: t('common.cancel') },
        { onPress: () => void change(minor, 'granted'), text: t('trip.giveConsent') },
      ]);
    }
  };
  return (
    <Surface style={{ gap: space.md }}>
      <Text accessibilityRole="header" variant="section">
        {t('trip.family')}
      </Text>
      {detail.minors.map((minor) => (
        <View key={minor.travellerId} style={{ gap: space.sm }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.sm }}>
            <Text style={{ flex: 1 }} variant="bodyStrong">
              {minor.fullName}
            </Text>
            <StatusPill kind={minor.consent === 'granted' ? 'good' : 'attention'} label={t(CONSENT_LABEL[minor.consent])} />
          </View>
          <Button
            busy={busy === minor.travellerId}
            label={minor.consent === 'granted' ? t('trip.withdrawConsent') : t('trip.giveConsent')}
            onPress={() => ask(minor)}
            variant="secondary"
          />
        </View>
      ))}
      {problem ? (
        <Banner tone="danger">
          <Text variant="secondary">{t('trip.consentFailed')}</Text>
        </Banner>
      ) : null}
    </Surface>
  );
}

/**
 * Wayfinding once the photo has scrolled away: a paper bar with the destination and a way back
 * fades in as the sheet reaches the top (scroll-linked on the UI thread, so it tracks the finger
 * and reverses with it). Reduced motion keeps the fade and drops the 6pt drop-in.
 */
function CompactBar({
  onSheet,
  scrollY,
  sheetTop,
  title,
}: {
  onSheet: boolean;
  scrollY: SharedValue<number>;
  sheetTop: SharedValue<number>;
  title: string;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const barStyle = useAnimatedStyle(() => {
    const top = sheetTop.get();
    const shown = top > 0 ? interpolate(scrollY.get(), [top - 48, top], [0, 1], Extrapolation.CLAMP) : 0;
    return { opacity: shown, transform: [{ translateY: reduced ? 0 : (1 - shown) * -6 }] };
  });
  return (
    <Animated.View
      pointerEvents={onSheet ? 'box-none' : 'none'}
      style={[
        {
          alignItems: 'center',
          backgroundColor: theme.color.ground,
          borderBottomColor: theme.color.rule,
          borderBottomWidth: StyleSheet.hairlineWidth,
          flexDirection: 'row',
          gap: space.md,
          left: 0,
          paddingBottom: space.sm,
          paddingHorizontal: theme.frame,
          paddingTop: insets.top + space.xs,
          position: 'absolute',
          right: 0,
          top: 0,
        },
        barStyle,
      ]}
    >
      <RoundBackButton onPaper />
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }} variant="bodyStrong">
        {title}
      </Text>
    </Animated.View>
  );
}

/** Today, who to call, updates, the plan, documents and the traveller's children. */
function TripSheet({ detail, now, offline, savedAt, tripId }: { detail: TripDetail; now: number; offline: boolean; savedAt: number | null; tripId: string }) {
  const theme = useAppTheme();
  const { t } = useI18n();
  const latest = detail.announcements.slice(0, 2);
  return (
    <>
      <Freshness offline={offline} savedAt={savedAt} />
      {detail.trip.role === 'organizer' ? (
        <Banner>
          <Text variant="secondary">{t('trip.organizerNote')}</Text>
        </Banner>
      ) : null}
      {tripStage(detail.trip, now).phase === 'ongoing' ? <TodayCard detail={detail} now={now} /> : null}

      <View style={{ gap: space.sm }}>
        <SectionTitle>{t('trip.contacts')}</SectionTitle>
        <ListCard>
          {detail.contacts.length === 0 ? (
            <Text style={{ paddingVertical: space.md }} tone="muted">
              {t('trip.noContacts')}
            </Text>
          ) : null}
          {detail.contacts.map((contact) => (
            <ContactRow contact={contact} key={contact.id} />
          ))}
          <Row
            chevron
            last
            leading={<Icon color={theme.color.primary} ios="envelope" md="mail" />}
            onPress={() => openUrl(`mailto:${CITIUS_EMAIL}`)}
            subtitle={CITIUS_EMAIL}
            title={t('trip.officeEmail')}
          />
        </ListCard>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle
          action={
            detail.announcements.length > latest.length
              ? { label: t('common.seeAll'), onPress: () => router.push({ params: { id: tripId }, pathname: '/trip/[id]/updates' }) }
              : undefined
          }
        >
          {t('trip.updates')}
        </SectionTitle>
        <ListCard>
          {latest.length === 0 ? (
            <Text style={{ paddingVertical: space.md }} tone="muted">
              {t('trip.noUpdates')}
            </Text>
          ) : null}
          {latest.map((announcement, index) => (
            <AnnouncementItem announcement={announcement} key={announcement.id} last={index === latest.length - 1} now={now} />
          ))}
        </ListCard>
      </View>

      <PlanPreview detail={detail} now={now} tripId={tripId} />
      {detail.documents.length ? <DocumentsCard documents={detail.documents} /> : null}
      {detail.minors.length ? <FamilyCard detail={detail} tripId={tripId} /> : null}
    </>
  );
}

/**
 * One trip. It opens in stages on a slow link: the photo header from the trip list at once, the
 * sheet's placeholders until the detail arrives, then the detail in their place. Nothing above the
 * sheet moves when it lands.
 */
export default function TripScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const i18n = useI18n();
  const { t } = i18n;
  const { offline } = useCustomerSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const trips = useTrips();
  const refresh = usePullRefresh(trip.status === 'live');
  const now = useNow();
  const detail = trip.data;
  const summary = detail?.trip ?? trips.data?.find((item) => item.tripId === id);
  // Light status bar icons over the dark photo; dark once the cream sheet slides under them.
  // The scroll position is read on the UI thread; React only hears when the edge is crossed.
  const [onSheet, setOnSheet] = useState(false);
  const sheetTop = useSharedValue(0);
  const sheetUnderBar = useSharedValue(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
    const top = sheetTop.get();
    const next = top > 0 && event.contentOffset.y >= top;
    if (next !== sheetUnderBar.get()) {
      sheetUnderBar.set(next);
      scheduleOnRN(setOnSheet, next);
    }
  });
  if (detail === null) return <TripUnavailable />;
  return (
    <View style={{ backgroundColor: theme.color.ground, flex: 1 }}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
        contentInsetAdjustmentBehavior="never"
        onScroll={onScroll}
        refreshControl={<RefreshControl onRefresh={refresh.onRefresh} refreshing={refresh.refreshing} tintColor="#ffffff" />}
        scrollEventThrottle={16}
        style={{ backgroundColor: theme.color.ground }}
      >
        <Stack.Screen options={{ statusBarStyle: onSheet ? 'dark' : 'light' }} />
        <View
          onLayout={(event) => {
            sheetTop.set(event.nativeEvent.layout.height - theme.radius.hero - space.sm - insets.top);
          }}
        >
          {summary ? (
            <TripHeader chips={yourChips(i18n, summary, detail)} now={now} scrollY={scrollY} trip={summary} />
          ) : (
            <TripHeroSkeleton back={<RoundBackButton />} />
          )}
        </View>
        <View
          style={{
            backgroundColor: theme.color.ground,
            borderTopLeftRadius: theme.radius.hero,
            borderTopRightRadius: theme.radius.hero,
            gap: space.lg + 4,
            marginTop: -theme.radius.hero - space.sm,
            paddingHorizontal: theme.frame,
            paddingTop: space.xl,
          }}
        >
          {detail ? (
            <TripSheet detail={detail} now={now} offline={offline} savedAt={trip.status === 'live' ? null : trip.savedAt} tripId={id ?? ''} />
          ) : trip.status === 'unavailable' ? (
            <NotSaved />
          ) : (
            <TripSheetSkeleton label={t('common.loading')} ongoing={summary ? tripStage(summary, now).phase === 'ongoing' : false} />
          )}
        </View>
      </Animated.ScrollView>
      {summary ? <CompactBar onSheet={onSheet} scrollY={scrollY} sheetTop={sheetTop} title={summary.destination} /> : null}
    </View>
  );
}
