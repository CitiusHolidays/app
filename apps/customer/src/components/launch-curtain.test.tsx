import { act, render, screen } from '@testing-library/react-native';
import { PixelRatio, StyleSheet, Text } from 'react-native';
import { useEffect } from 'react';

import { LaunchCurtain, TEXTURE_LAYERS, useLaunchDone } from './launch-curtain';

// Motion is checked on device; here timings finish at once so the hand-off logic can be tested.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    cubicBezier: () => 'ease-out',
    default: { View },
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    useSharedValue: (initial: unknown) => {
      let value = initial;
      return { get: () => value, set: (next: unknown) => (value = next) };
    },
    withTiming: (to: unknown, _config: unknown, done?: (finished: boolean) => void) => {
      done?.(true);
      return to;
    },
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(async () => undefined) }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: (props: object) => <View testID="image" {...props} /> };
});

const SplashScreen = jest.requireMock<{ hideAsync: jest.Mock }>('expo-splash-screen');

function ReadyWhen({ ready }: { ready: boolean }) {
  const done = useLaunchDone();
  useEffect(() => {
    if (ready) done();
  }, [done, ready]);
  return <Text>First screen</Text>;
}

/** The first image is the texture; it reports onDisplay once decoded. */
function showTexture() {
  const [image] = screen.getAllByTestId('image');
  (image?.props as { onDisplay: () => void }).onDisplay();
}

describe('launch curtain', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    SplashScreen.hideAsync.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('keeps the native splash until the texture is on screen, then hides it', async () => {
    await render(
      <LaunchCurtain>
        <ReadyWhen ready={false} />
      </LaunchCurtain>
    );
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    await act(async () => showTexture());
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Citius')).toBeOnTheScreen();
  });

  it('stays over the app until it is ready, then goes', async () => {
    const view = await render(
      <LaunchCurtain>
        <ReadyWhen ready={false} />
      </LaunchCurtain>
    );
    await act(async () => showTexture());
    expect(screen.getByLabelText('Citius')).toBeOnTheScreen();
    await view.rerender(
      <LaunchCurtain>
        <ReadyWhen ready />
      </LaunchCurtain>
    );
    expect(screen.queryByLabelText('Citius')).not.toBeOnTheScreen();
    expect(screen.getByText('First screen')).toBeOnTheScreen();
  });

  it("tiles the website's doodles at their native size, never enlarged", async () => {
    await render(
      <LaunchCurtain>
        <ReadyWhen ready={false} />
      </LaunchCurtain>
    );
    const tiles = screen.getAllByTestId('image').slice(0, -1); // the last image is the planes
    const first = StyleSheet.flatten(tiles[0]?.props.style);
    expect(first.width).toBeCloseTo(1919 / PixelRatio.get());
    expect(first.height).toBeCloseTo(956 / PixelRatio.get());
    expect(tiles.length % TEXTURE_LAYERS).toBe(0);
    expect(tiles.length).toBeGreaterThanOrEqual(TEXTURE_LAYERS);
  });

  it('never strands the app behind the native splash if the texture does not load', async () => {
    await render(
      <LaunchCurtain>
        <ReadyWhen ready />
      </LaunchCurtain>
    );
    expect(screen.getByLabelText('Citius')).toBeOnTheScreen();
    await act(async () => jest.advanceTimersByTime(1500));
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
    expect(screen.queryByLabelText('Citius')).not.toBeOnTheScreen();
  });
});
