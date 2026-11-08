import { customerApi, type ConsentState, PARENTAL_CONSENT_TEXT_VERSION, type TripDetail } from '@citius/backend/customer';
import { Banner, Button, PressableScale, space, StatusPill, Surface, Text, useAppTheme } from '@citius/ui';
import { tripSchedule } from '@citius/core/src/schedule';
import { useMutation } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
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

import { Icon, ListCard, MessageScreen, Row, SectionTitle } from '@/components/kit';
import { TripSkeleton } from '@/components/skeletons';
import { DestinationCover } from '@/components/destination-cover';
import { Freshness } from '@/components/trip-cards';
import { AnnouncementItem, ContactRow, DocumentsCard } from '@/components/trip-sections';
import { useCustomerSession } from '@/features/session/session';
import { CITIUS_EMAIL } from '@/features/support/contacts';
import { datesAndNights, timingText } from '@/features/trips/labels';
import { dayNumber, tripTiming } from '@/features/trips/model';
import { useTrip } from '@/features/trips/use-trips';
import { useI18n } from '@/i18n/i18n';
import type { MessageKey } from '@/i18n/locales/en';
import { EASE_OUT } from '@/components/motion';
import { Rise } from '@/components/motion-views';
import { haptic } from '@/lib/haptic';
import { runThen } from '@/lib/run-then';
import { logEvent } from '@/lib/safe-log';
import { useNow } from '@/lib/use-now';

function BackButton({ onPaper }: { onPaper?: boolean }) {
  const theme = useAppTheme();
  const { t } = useI18n();
  return (
    <PressableScale
      accessibilityLabel={t('common.back')}
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={{
        alignItems: 'center',
        backgroundColor: onPaper ? theme.color.card : 'rgba(11,16,38,0.45)',
        borderColor: onPaper ? theme.color.border : 'rgba(255,255,255,0.35)',
        borderRadius: 24,
        borderWidth: 1,
        height: 48,
        justifyContent: 'center',
        width: 48,
      }}
    >
      <Icon color={onPaper ? theme.color.ink : '#ffffff'} ios="chevron.left" md="arrow_back" size={18} />
    </PressableScale>
  );
}

/** The destination edge to edge, with the trip's name, dates, timing and the traveller's own line. */
function TripHeader({ detail, now, scrollY }: { detail: TripDetail; now: number; scrollY: SharedValue<number> }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const heroHeight = insets.top + 470;
  // The photo stays pinned and stretches when pulled down (iOS), and drifts at half speed as the
  // page scrolls up, so the sheet slides over it. Transform only, on the UI thread.
  // Continuity from the Journeys card: the same photo arrives a touch closer, as the card was, and
  // settles back while the push lands (500ms ease-out, once).
  const settle = useSharedValue(reduced ? 0 : 1);
  useEffect(() => {
    settle.set(withTiming(0, { duration: 500, easing: EASE_OUT }));
  }, [settle]);
  const photoStyle = useAnimatedStyle(() => {
    if (reduced) return { transform: [] };
    const y = scrollY.get();
    const arrive = 1 + settle.get() * 0.06;
    if (y < 0) return { transform: [{ translateY: y / 2 }, { scale: (1 - y / heroHeight) * arrive }] };
    return { transform: [{ translateY: Math.min(y, heroHeight) * 0.45 }, { scale: arrive }] };
  });
  const i18n = useI18n();
  const { trip } = detail;
  const timing = tripTiming(trip, now);
  const yourLine = [
    detail.me ? i18n.t('trip.you', { name: detail.me.fullName }) : null,
    detail.me?.groupCode ? i18n.t('trip.group', { code: detail.me.groupCode }) : null,
    detail.minors.length ? i18n.tn('journeys.withChildren', detail.minors.length) : null,
  ].filter((item): item is string => Boolean(item));
  return (
    <View style={{ backgroundColor: theme.color.dark, minHeight: heroHeight }}>
      <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
        <DestinationCover photo={trip.cover} priority="high" scrim="full" />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingBottom: space.xxl + space.xl, paddingHorizontal: theme.frame, paddingTop: insets.top + space.sm }}>
        <BackButton />
        <View style={{ gap: space.sm }}>
          <Rise delay={120} index={0}>
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
            <View style={{ backgroundColor: trip.phase === 'ongoing' ? '#f58220' : theme.color.warning, borderRadius: 4, height: 8, width: 8 }} />
            <Text style={{ color: theme.color.warning }} variant="label">
              {trip.phase === 'past' ? i18n.t('phase.past') : timingText(i18n, timing)}
            </Text>
          </View>
          </Rise>
          <Rise delay={120} index={1}>
          <View accessible accessibilityRole="header" style={{ gap: space.xs }}>
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.78)' }} variant="secondary">
              {trip.groupName}
            </Text>
            <Text style={{ fontSize: 46, lineHeight: 50 }} tone="onDark" variant="display">
              {trip.destination}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{datesAndNights(i18n, trip)}</Text>
          </View>
          </Rise>
          {yourLine.length ? (
            <Rise delay={120} index={2} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.xs }}>
              {yourLine.map((item) => (
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
            </Rise>
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
  return (
    <Surface variant="hero" style={{ borderColor: theme.color.primary, borderWidth: 1.5, gap: space.sm }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.sm }}>
        <View style={{ backgroundColor: '#f58220', borderRadius: 5, height: 10, width: 10 }} />
        <Text accessibilityRole="header" tone="warning" variant="bodyStrong">
          {t('trip.today')}
          {today?.date ? ` · ${weekday(today.date)}` : ''}
        </Text>
      </View>
      {today ? (
        <>
          <Text variant="section">{dayNumber(today.dayLabel) ? t('plan.day', { day: dayNumber(today.dayLabel) ?? '' }) : ''}</Text>
          <Text>{today.text || t('trip.todayNothing')}</Text>
        </>
      ) : (
        <Text tone="muted">{t('trip.todayNothing')}</Text>
      )}
      {next?.text ? (
        <Text numberOfLines={2} tone="muted" variant="secondary">
          {dayNumber(next.dayLabel) ? `${t('plan.day', { day: dayNumber(next.dayLabel) ?? '' })}: ` : ''}
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
  const shown = (detail.trip.phase === 'past' ? steps : steps.slice(firstOpen)).slice(0, 3);
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
  const askToWithdraw = (minor: TripDetail['minors'][number]) => {
    const name = minor.fullName.split(' ')[0] ?? minor.fullName;
    Alert.alert(t('trip.withdrawTitle', { name }), t('trip.withdrawBody', { name }), [
      { style: 'cancel', text: t('common.cancel') },
      { onPress: () => void change(minor, 'withdrawn'), style: 'destructive', text: t('trip.withdrawConsent') },
    ]);
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
            onPress={() => (minor.consent === 'granted' ? askToWithdraw(minor) : void change(minor, 'granted'))}
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

/** One trip: today, who to call, updates, the plan, documents and the traveller's children. */
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
      <BackButton onPaper />
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }} variant="bodyStrong">
        {title}
      </Text>
    </Animated.View>
  );
}

export default function TripScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { gate } = useCustomerSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const now = useNow();
  const detail = trip.data;
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
  if (detail === null) {
    return (
      <>
        <Stack.Screen options={{ statusBarStyle: 'dark' }} />
        <MessageScreen
          actions={<Button label={t('common.close')} onPress={() => router.replace('/')} variant="secondary" />}
          icon={{ ios: 'eye.slash', md: 'visibility_off' }}
          text={t('trip.notAvailableBody')}
          title={t('trip.notAvailableTitle')}
        />
      </>
    );
  }
  if (!detail) {
    return (
      <>
        <Stack.Screen options={{ statusBarStyle: 'light' }} />
        <TripSkeleton back={<BackButton />} label={t('common.loading')} />
      </>
    );
  }
  const offline = gate.kind === 'signedIn' && gate.offline;
  const latest = detail.announcements.slice(0, 2);
  return (
    <View style={{ backgroundColor: theme.color.ground, flex: 1 }}>
    <Animated.ScrollView
      contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
      contentInsetAdjustmentBehavior="never"
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={{ backgroundColor: theme.color.ground }}
    >
      <Stack.Screen options={{ statusBarStyle: onSheet ? 'dark' : 'light' }} />
      <View
        onLayout={(event) => {
          sheetTop.set(event.nativeEvent.layout.height - theme.radius.hero - space.sm - insets.top);
        }}
      >
        <TripHeader detail={detail} now={now} scrollY={scrollY} />
      </View>
      {/* The sheet rises over the photo as the trip opens, once. */}
      <Rise
        delay={60}
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
        <Freshness offline={offline} savedAt={trip.live ? null : trip.savedAt} />
        {detail.trip.role === 'organizer' ? (
          <Banner>
            <Text variant="secondary">{t('trip.organizerNote')}</Text>
          </Banner>
        ) : null}
        {detail.trip.phase === 'ongoing' ? <TodayCard detail={detail} now={now} /> : null}

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
              onPress={() => void Linking.openURL(`mailto:${CITIUS_EMAIL}`).catch(() => undefined)}
              subtitle={CITIUS_EMAIL}
              title={t('trip.officeEmail')}
            />
          </ListCard>
        </View>

        <View style={{ gap: space.sm }}>
          <SectionTitle
            action={
              detail.announcements.length > latest.length
                ? { label: t('common.seeAll'), onPress: () => router.push({ params: { id: id ?? '' }, pathname: '/trip/[id]/updates' }) }
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

        <PlanPreview detail={detail} now={now} tripId={id ?? ''} />
        {detail.documents.length ? <DocumentsCard documents={detail.documents} /> : null}
        {detail.minors.length ? <FamilyCard detail={detail} tripId={id ?? ''} /> : null}
      </Rise>
    </Animated.ScrollView>
    <CompactBar onSheet={onSheet} scrollY={scrollY} sheetTop={sheetTop} title={detail.trip.destination} />
    </View>
  );
}
