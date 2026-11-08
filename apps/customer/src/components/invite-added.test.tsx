import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { customerTheme, ThemeProvider } from '@citius/ui';

import { AddedMoment } from './invite-added';

const shown = (node: React.ReactElement) =>
  render(
    <ThemeProvider theme={customerTheme}>{node}</ThemeProvider>
  );

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/haptic', () => ({ haptic: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }) }));
jest.mock('@/components/motion-views', () => {
  const { View } = jest.requireActual('react-native');
  return { Pop: View, Rise: View };
});
jest.mock('@/i18n/i18n', () => {
  const { en } = jest.requireActual('@/i18n/locales/en');
  return {
    useI18n: () => ({
      t: (key: string, vars: Record<string, string> = {}) =>
        (en[key] as string).replace(/\{(\w+)\}/g, (_match: string, name: string) => vars[name] ?? ''),
    }),
  };
});
jest.mock('@/components/kit', () => {
  const { View } = jest.requireActual('react-native');
  return { Icon: () => null, TopTint: () => <View /> };
});

const { router } = jest.requireMock<{ router: { replace: jest.Mock } }>('expo-router');
const { haptic } = jest.requireMock<{ haptic: jest.Mock }>('@/lib/haptic');

describe('invite added moment', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    router.replace.mockClear();
    haptic.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('celebrates once, then opens the trip by itself', async () => {
    await shown(<AddedMoment destination="Bali" tripId="trip-1" />);
    expect(haptic).toHaveBeenCalledTimes(1);
    expect(haptic).toHaveBeenCalledWith('success');
    expect(screen.getByText('Bali is in your trips now.')).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1800));
    expect(router.replace).toHaveBeenCalledWith({ params: { id: 'trip-1' }, pathname: '/trip/[id]' });
  });

  it('opens at once from the button, and goes to Journeys when the trip is hidden', async () => {
    await shown(<AddedMoment destination={null} tripId={null} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open trip' }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
