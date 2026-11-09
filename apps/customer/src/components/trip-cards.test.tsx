import type { TripSummary } from '@citius/backend/customer';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/render';

import { TripCard } from './trip-cards';

jest.mock('@/lib/env', () => ({ WEBSITE_URL: 'https://example.com' }));
jest.mock('@/components/destination-cover', () => ({ DestinationCover: () => null }));
jest.mock('@/i18n/i18n', () => {
  const { en } = jest.requireActual('@/i18n/locales/en');
  const fill = (text: string, vars: Record<string, string | number>) =>
    text.replace(/\{(\w+)\}/g, (_match: string, name: string) => String(vars[name] ?? ''));
  const t = (key: string, vars: Record<string, string | number> = {}) => fill(en[key] as string, vars);
  const tn = (key: string, count: number) => fill(en[`${key}_${count === 1 ? 'one' : 'other'}`] as string, { count });
  return { useI18n: () => ({ dayRange: () => '15–20 Nov', formatDate: () => 'date', locale: 'en', t, tn }) };
});

const trip: TripSummary = {
  cover: null,
  destination: 'Bali',
  groupCode: 'B01',
  groupName: 'Synthetic group',
  jobCode: 'JC-1',
  minorCount: 0,
  phase: 'upcoming',
  role: 'traveller',
  travelEndDate: '2026-11-20',
  travelStartDate: '2026-11-15',
  travellerName: 'Asha Testguest',
  tripId: 't1',
};

const now = new Date(2026, 10, 3, 10).getTime();

describe('trip card', () => {
  it('shows the traveller their own group', async () => {
    await renderWithTheme(<TripCard now={now} onPress={jest.fn()} trip={trip} />);
    expect(screen.getByText(/You: Asha Testguest · Group B01/)).toBeOnTheScreen();
  });

  it('leaves the group out when there is none, or the trip was saved before groups existed', async () => {
    const { groupCode: _dropped, ...savedByOlderBuild } = trip;
    for (const summary of [{ ...trip, groupCode: null }, savedByOlderBuild]) {
      await renderWithTheme(<TripCard now={now} onPress={jest.fn()} trip={summary} />);
      expect(screen.queryByText(/Group/)).toBeNull();
      expect(screen.getByText('You: Asha Testguest')).toBeOnTheScreen();
    }
  });
});
