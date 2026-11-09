import type { NotificationRow } from '@citius/backend';
import { space, Surface, Text, useAppTheme } from '@citius/ui';
import { router } from 'expo-router';
import { View } from 'react-native';

import { FreshnessStamp } from '@/components/freshness';
import { Arrive, ListCard, PlaceholderBar, PlaceholderRows, QuietState, Row, Screen, SectionTitle } from '@/components/kit';
import { fullTime, relativeTime } from '@/features/inbox/relative-time';
import { useInbox } from '@/features/inbox/use-inbox';
import { useNow } from '@/lib/use-now';

/** Space between the inbox's sections (New, Earlier, the footer). */
const SECTION_GAP = space.lg + 4;

/**
 * An 8pt Citius-blue dot for unread; read rows keep the space so titles line up. Static: a read
 * notification moves from New to Earlier, so a dot never changes in place.
 */
function UnreadDot({ unread }: { unread: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={{ alignSelf: 'flex-start', height: 22, justifyContent: 'center', width: 8 }}>
      {unread ? <View style={{ backgroundColor: theme.color.accent, borderRadius: 4, height: 8, width: 8 }} /> : null}
    </View>
  );
}

function NotificationList({ now, rows }: { now: number; rows: NotificationRow[] }) {
  return (
    <ListCard>
      {rows.map((row, index) => {
        const unread = !row.readAt;
        return (
          <Row
            accessibilityLabel={`${unread ? 'Unread. ' : ''}${row.title}. ${row.body}. ${fullTime(row.createdAt)}`}
            key={row.id}
            last={index === rows.length - 1}
            leading={<UnreadDot unread={unread} />}
            onPress={() => router.push({ params: { id: row.id }, pathname: '/notification/[id]' })}
            subtitle={row.body}
            title={row.title}
            trailing={
              <Text style={{ alignSelf: 'flex-start', paddingTop: 3 }} tabular tone="muted" variant="label">
                {relativeTime(row.createdAt, now)}
              </Text>
            }
          />
        );
      })}
    </ListCard>
  );
}

/** Stands in for the first section while the list loads: a section title over a card of rows. */
function InboxSkeleton() {
  return (
    <View style={{ gap: space.md }}>
      <PlaceholderBar role="section" width="35%" />
      <PlaceholderRows rows={4} />
    </View>
  );
}

function Notifications({ rows }: { rows: NotificationRow[] }) {
  const now = useNow();
  const unread = rows.filter((row) => !row.readAt);
  const read = rows.filter((row) => row.readAt);
  return (
    <Arrive gap={SECTION_GAP}>
      {unread.length === 0 ? (
        <Surface>
          <QuietState good text="You're all caught up." />
        </Surface>
      ) : (
        <View style={{ gap: space.md }}>
          <SectionTitle>{`New · ${unread.length}`}</SectionTitle>
          <NotificationList now={now} rows={unread} />
        </View>
      )}
      {read.length > 0 ? (
        <View style={{ gap: space.md }}>
          <SectionTitle>Earlier</SectionTitle>
          <NotificationList now={now} rows={read} />
        </View>
      ) : null}
      <Text tone="muted" variant="secondary">
        Push alerts are not switched on yet. New notifications appear here when the app is open.
      </Text>
    </Arrive>
  );
}

/** "What needs me?" New notifications first, then the rest. */
export default function Inbox() {
  const { savedAt, state } = useInbox();
  return (
    <Screen title="Inbox">
      <FreshnessStamp savedAt={savedAt} />
      {state.kind === 'reading' || state.kind === 'fetching' ? <InboxSkeleton /> : null}
      {state.kind === 'unreachable' ? (
        <Surface>
          <QuietState text="Connect to load your inbox. It stays on this phone once it has loaded." />
        </Surface>
      ) : null}
      {state.kind === 'cached' || state.kind === 'live' ? <Notifications rows={state.rows} /> : null}
    </Screen>
  );
}
