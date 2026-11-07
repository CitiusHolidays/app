import { customerApi } from '@citius/backend/customer';
import { space, Surface, Text, useAppTheme } from '@citius/ui';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { Alert, Linking, View } from 'react-native';

import { Avatar, CallButton, Icon, ListCard, PageTitle, Row, Screen, SectionTitle } from '@/components/kit';
import { useCustomerSession } from '@/features/session/session';
import { CITIUS_EMAIL, CITIUS_OFFICES, PRIVACY_URL, TERMS_URL } from '@/features/support/contacts';
import { useTrips } from '@/features/trips/use-trips';
import { useI18n } from '@/i18n/i18n';

function open(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** The account, language, help and legal links, sign-out and account deletion. */
export default function Me() {
  const theme = useAppTheme();
  const { language, t } = useI18n();
  const { gate, signOut } = useCustomerSession();
  const live = gate.kind === 'signedIn' && !gate.offline;
  const profile = useQuery(customerApi.getMyProfile.ref, live ? {} : 'skip');
  const trips = useTrips();
  const travellerName = trips.data?.find((trip) => trip.travellerName)?.travellerName ?? null;
  // An email-link account has no name of its own, so Citius's record of the traveller comes first.
  const name = travellerName || profile?.name?.trim() || t('me.traveller');
  const confirmSignOut = () =>
    Alert.alert(t('me.signOutConfirmTitle'), t('me.signOutConfirmBody'), [
      { style: 'cancel', text: t('common.cancel') },
      { onPress: () => void signOut(), style: 'destructive', text: t('me.signOut') },
    ]);
  return (
    <Screen header={<PageTitle title={t('me.title')} />}>
      <Surface variant="hero" style={{ alignItems: 'center', backgroundColor: theme.color.dark, borderColor: theme.color.dark, flexDirection: 'row', gap: space.lg }}>
        <Avatar name={name} size={56} tone="dark" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} tone="onDark" variant="section">
            {name}
          </Text>
          {profile?.email ? (
            <Text numberOfLines={1} tone="onDarkMuted" variant="secondary">
              {t('me.signedInAs', { email: profile.email })}
            </Text>
          ) : null}
        </View>
      </Surface>

      <ListCard>
        <Row
          chevron
          last
          leading={<Icon color={theme.color.primary} ios="globe" md="language" />}
          onPress={() => router.push('/language')}
          subtitle={language.nativeName}
          title={t('me.language')}
        />
      </ListCard>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{t('me.help')}</SectionTitle>
        <ListCard>
          {CITIUS_OFFICES.map((office) => (
            <Row
              key={office.city}
              leading={<Icon color={theme.color.primary} ios="building.2" md="apartment" />}
              subtitle={office.displayPhone}
              title={t('trip.office', { city: office.city })}
              trailing={<CallButton label={t('common.call', { name: t('trip.office', { city: office.city }) })} phone={office.dialPhone} />}
            />
          ))}
          <Row
            chevron
            last
            leading={<Icon color={theme.color.primary} ios="envelope" md="mail" />}
            onPress={() => open(`mailto:${CITIUS_EMAIL}`)}
            subtitle={CITIUS_EMAIL}
            title={t('trip.officeEmail')}
          />
        </ListCard>
      </View>

      <ListCard>
        <Row chevron leading={<Icon color={theme.color.muted} ios="hand.raised" md="privacy_tip" />} onPress={() => open(PRIVACY_URL)} title={t('me.privacy')} />
        <Row chevron last leading={<Icon color={theme.color.muted} ios="doc.text" md="description" />} onPress={() => open(TERMS_URL)} title={t('me.terms')} />
      </ListCard>

      <ListCard>
        <Row chevron leading={<Icon color={theme.color.ink} ios="rectangle.portrait.and.arrow.right" md="logout" />} onPress={confirmSignOut} title={t('me.signOut')} />
        <Row
          chevron
          last
          leading={<Icon color={theme.color.danger} ios="trash" md="delete" />}
          onPress={() => router.push('/delete-account')}
          title={t('me.delete')}
        />
      </ListCard>

      <Text style={{ textAlign: 'center' }} tone="muted" variant="label">
        {t('me.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
      </Text>
    </Screen>
  );
}
