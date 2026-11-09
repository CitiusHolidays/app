import type { TripDetail } from '@citius/backend/customer';
import { citius, space, StatusPill, Surface, Text, useAppTheme } from '@citius/ui';
import { StyleSheet, View } from 'react-native';

import { Avatar, CallButton } from '@/components/kit';
import { documentProgress, shownVisaStatus, statusKind } from '@/features/trips/model';
import { useI18n } from '@/i18n/i18n';

/** A tour manager the traveller can call, with their reporting note. */
export function ContactRow({ contact, last }: { contact: TripDetail['contacts'][number]; last?: boolean }) {
  const theme = useAppTheme();
  const { t } = useI18n();
  const role = contact.scope === 'group' ? t('trip.contactGroup') : t('trip.contactTrip');
  return (
    <View
      style={{
        borderBottomColor: theme.color.rule,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        gap: space.sm,
        paddingVertical: space.md,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.md }}>
        <Avatar name={contact.name} size={44} />
        <View accessible style={{ flex: 1, gap: 2 }}>
          <Text variant="rowTitle">{contact.name}</Text>
          <Text tone="muted" variant="secondary">
            {role}
          </Text>
          {contact.phone ? (
            <Text tabular tone="muted" variant="label">
              {contact.phone}
            </Text>
          ) : null}
        </View>
        {contact.phone ? <CallButton label={t('common.call', { name: contact.name })} phone={contact.phone} /> : null}
      </View>
      {contact.reportingInstructions ? (
        <View style={{ backgroundColor: theme.color.inset, borderRadius: theme.radius.inset, padding: space.md }}>
          <Text variant="secondary">{contact.reportingInstructions}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Each person's passport, visa and ticket status words, as Operations recorded them. */
export function DocumentsCard({ documents }: { documents: TripDetail['documents'] }) {
  const theme = useAppTheme();
  const { t, tWord } = useI18n();
  const { done, total } = documentProgress(documents);
  return (
    <Surface style={{ gap: space.md }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" variant="section">
          {t('trip.documents')}
        </Text>
        <Text tabular tone={done === total ? 'success' : 'muted'} variant="bodyStrong">
          {done}/{total}
        </Text>
      </View>
      <View style={{ backgroundColor: theme.color.track, borderRadius: 3, height: 6, overflow: 'hidden' }}>
        <View style={{ backgroundColor: theme.color.success, height: 6, width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
      </View>
      {documents.map((person, index) => {
        const rows = [
          { kind: 'passport', label: t('doc.passport'), status: person.passportStatus },
          { kind: 'visa', label: t('doc.visa'), status: shownVisaStatus(person) },
          { kind: 'ticket', label: t('doc.ticket'), status: person.ticketStatus },
        ];
        return (
          <View
            key={person.travellerId}
            style={{
              borderTopColor: theme.color.rule,
              borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
              gap: space.sm,
              paddingTop: index === 0 ? 0 : space.md,
            }}
          >
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.sm }}>
              <Text style={{ flex: 1 }} variant="bodyStrong">
                {person.fullName}
              </Text>
              {person.isMinor ? <StatusPill kind="neutral" label={t('trip.minor')} /> : null}
            </View>
            {rows.map((row) => (
              <View key={row.kind} style={{ alignItems: 'center', flexDirection: 'row', gap: space.md, minHeight: 32 }}>
                <Text style={{ flex: 1 }} tone="muted" variant="secondary">
                  {row.label}
                </Text>
                <StatusPill
                  kind={statusKind(row.status)}
                  label={row.status ? tWord(`status.${row.kind}.${row.status}`, row.status) : t('doc.notRecorded')}
                />
              </View>
            ))}
          </View>
        );
      })}
      <Text tone="muted" variant="label">
        {t('trip.documentsNote')}
      </Text>
    </Surface>
  );
}

/** One message from a tour manager. */
export function AnnouncementItem({
  announcement,
  last,
  now,
}: {
  announcement: TripDetail['announcements'][number];
  last?: boolean;
  now: number;
}) {
  const theme = useAppTheme();
  const { moment, t } = useI18n();
  return (
    <View
      accessible
      style={{
        borderBottomColor: theme.color.rule,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        flexDirection: 'row',
        gap: space.md,
        paddingVertical: space.md,
      }}
    >
      <View style={{ backgroundColor: citius.orange, borderRadius: 2, marginTop: 6, width: 3 }} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text>{announcement.body}</Text>
        <Text tone="muted" variant="label">
          {t('updates.from', { name: announcement.authorName })} · {moment(announcement.sharedAt, now)}
        </Text>
      </View>
    </View>
  );
}
