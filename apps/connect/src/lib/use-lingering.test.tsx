import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { LINGER_MS, useLingering } from './use-lingering';

function Probe() {
  const { hold, held } = useLingering();
  return (
    <Pressable accessibilityRole="button" onPress={() => hold('t1')}>
      <Text>{held.has('t1') ? 'held' : 'free'}</Text>
    </Pressable>
  );
}

describe('useLingering', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps a just-changed row for a moment, then lets it go', async () => {
    await render(<Probe />);
    await act(async () => fireEvent.press(screen.getByRole('button')));
    expect(screen.getByText('held')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(LINGER_MS - 1);
    });
    expect(screen.getByText('held')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByText('free')).toBeOnTheScreen();
  });

  it('restarts the wait when the same row is changed again', async () => {
    await render(<Probe />);
    await act(async () => fireEvent.press(screen.getByRole('button')));
    await act(async () => {
      jest.advanceTimersByTime(LINGER_MS - 100);
    });
    await act(async () => fireEvent.press(screen.getByRole('button')));
    await act(async () => {
      jest.advanceTimersByTime(LINGER_MS - 100);
    });
    expect(screen.getByText('held')).toBeOnTheScreen();
  });
});
