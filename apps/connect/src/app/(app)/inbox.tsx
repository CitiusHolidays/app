import { Text } from '@citius/ui';
import { router } from 'expo-router';
import { View } from 'react-native';

import { FreshnessStamp } from '@/components/freshness';
import { Placeholder, Row, Screen } from '@/components/kit';
import { useInbox } from '@/features/inbox/use-inbox';

function relativeTime(iso: string) {
  const value = Date.parse(iso);
  if (Number.isNaN(value)) return '';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' }).format(value);
}

export default function Inbox() {
  const { loaded, rows, savedAt } = useInbox();
  return (
    <Screen title="Inbox">
      <FreshnessStamp savedAt={savedAt} />
      {!loaded ? <Placeholder lines={5} /> : null}
      {loaded && rows.length === 0 ? <Text tone="muted">No notifications yet.</Text> : null}
      <View>
        {rows.map((row) => (
          <Row
            accessibilityLabel={`${row.readAt ? '' : 'Unread. '}${row.title}. ${row.body}`}
            key={row.id}
            onPress={() => router.push({ params: { id: row.id }, pathname: '/notification/[id]' })}
            subtitle={`${relativeTime(row.createdAt)} · ${row.body}`}
            title={`${row.readAt ? '' : '● '}${row.title}`}
          />
        ))}
      </View>
      <Text variant="secondary" tone="muted">
        Push alerts are not switched on yet. New notifications appear here when the app is open.
      </Text>
    </Screen>
  );
}
