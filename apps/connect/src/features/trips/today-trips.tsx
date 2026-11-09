import { space, useAppTheme } from '@citius/ui';
import { View } from 'react-native';

import { Icon, ListCard, Row, SectionTitle } from '@/components/kit';
import { formatDateRange } from '@/lib/dates';
import { tick } from '@/lib/haptics';
import { useToast } from '@/lib/toast';

import { phaseLabel } from './trips';
import { useTrips } from './trips-context';

function SelectedMark() {
  const theme = useAppTheme();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{ alignItems: 'center', backgroundColor: theme.color.successSoft, borderRadius: 14, height: 28, justifyContent: 'center', width: 28 }}
    >
      <Icon color={theme.color.success} ios="checkmark" md="check" size={14} />
    </View>
  );
}

/**
 * The tour manager's trips, to switch between when there is more than one. The trip on show is
 * marked with a check; each trip's status is plain text. Switching says so near the finger, since
 * the trip card it changes is at the top of the screen.
 */
export function YourTrips({ now }: { now: number }) {
  const { selectTrip, selected, trips } = useTrips();
  const toast = useToast();
  if (trips.length <= 1) return null;
  return (
    <View style={{ gap: space.md }}>
      <SectionTitle>Your trips</SectionTitle>
      <ListCard>
        {trips.map((trip, index) => {
          const isSelected = trip.id === selected?.id;
          const name = trip.clientName || trip.jobCode;
          const dates = formatDateRange(trip.travelStartDate, trip.travelEndDate);
          const phase = phaseLabel(trip, now);
          const facts = [trip.jobCode, dates, phase, trip.status && trip.status !== phase ? trip.status : null].filter(Boolean);
          return (
            <Row
              accessibilityLabel={`${name}, ${facts.slice(1).join(', ')}${isSelected ? ', showing now' : ''}`}
              key={trip.id}
              last={index === trips.length - 1}
              onPress={() => {
                if (isSelected) return;
                tick();
                selectTrip(trip.id);
                toast(`Showing ${name}`);
              }}
              subtitle={facts.join(' · ')}
              title={name}
              trailing={isSelected ? <SelectedMark /> : undefined}
            />
          );
        })}
      </ListCard>
    </View>
  );
}
