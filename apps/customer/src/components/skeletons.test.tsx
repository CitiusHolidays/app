import { render, screen } from '@testing-library/react-native';

import { customerTheme, ThemeProvider } from '@citius/ui';

import Journeys from '@/app/(tabs)/index';
import Updates from '@/app/(tabs)/updates';

import { AnnouncementRows, JourneysSkeleton } from './skeletons';

jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: (props: object) => <View {...props} /> };
});
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/env', () => ({ WEBSITE_URL: 'https://www.citiusholidays.com' }));
jest.mock('@/components/destination-cover', () => ({ DestinationCover: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }) }));
jest.mock('@/i18n/i18n', () => {
  const { en } = jest.requireActual('@/i18n/locales/en');
  const t = (key: string, vars: Record<string, string> = {}) =>
    (en[key] as string).replace(/\{(\w+)\}/g, (_match: string, name: string) => vars[name] ?? '');
  return { useI18n: () => ({ language: { code: 'en', intl: 'en-IN' }, t }) };
});
jest.mock('@/features/session/session', () => ({ useCustomerSession: () => ({ gate: { kind: 'signedIn', offline: false }, live: true, offline: false }) }));
let mockTripsStatus = 'loading';
jest.mock('@/features/trips/use-trips', () => ({
  useTrips: () => ({ data: undefined, savedAt: null, status: mockTripsStatus }),
}));
jest.mock('@/features/trips/prefetch-cover', () => ({ prefetchCover: jest.fn() }));
jest.mock('@/lib/use-now', () => ({ useNow: () => Date.UTC(2026, 10, 9) }));
jest.mock('@/lib/use-pull-refresh', () => ({ usePullRefresh: () => ({ onRefresh: jest.fn(), refreshing: false }) }));

const withTheme = (node: React.ReactElement) => render(<ThemeProvider theme={customerTheme}>{node}</ThemeProvider>);

/** True when the element, or anything holding it, is drawn fully transparent. */
type Rendered = { parent: Rendered | null; props: { style?: unknown } };

function hiddenByAncestor(element: Rendered | null): boolean {
  for (let node = element; node; node = node.parent) {
    const style = [node.props.style].flat(Infinity) as ({ opacity?: number } | null | undefined)[];
    if (style.some((entry) => entry?.opacity === 0)) return true;
  }
  return false;
}

describe('loading placeholders', () => {
  beforeEach(() => {
    mockTripsStatus = 'loading';
  });

  it('says nothing is saved yet instead of shimmering forever when offline with no saved trips', async () => {
    mockTripsStatus = 'unavailable';
    await withTheme(<Journeys />);
    expect(screen.queryByLabelText('Loading')).toBeNull();
    expect(screen.getByText(/isn't saved on this phone yet/)).toBeOnTheScreen();
  });

  it('Journeys shows its placeholder while trips load, not an empty screen', async () => {
    await withTheme(<Journeys />);
    const placeholder = screen.getByLabelText('Loading');
    expect(placeholder).toBeOnTheScreen();
    expect(hiddenByAncestor(placeholder)).toBe(false);
  });

  it('Updates shows its placeholder while trips load, not an empty screen', async () => {
    await withTheme(<Updates />);
    const placeholder = screen.getByLabelText('Loading');
    expect(placeholder).toBeOnTheScreen();
    expect(hiddenByAncestor(placeholder)).toBe(false);
  });

  it('reads as one loading element, not a pile of empty lines', async () => {
    await withTheme(<JourneysSkeleton label="Loading" />);
    expect(screen.getAllByLabelText('Loading')).toHaveLength(1);
    // The sizing lines inside the bars are hidden from screen readers.
    expect(screen.queryAllByText(' ')).toHaveLength(0);
  });

  it('draws one row per message it stands in for', async () => {
    await withTheme(<AnnouncementRows count={3} label="Loading" />);
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
  });
});
