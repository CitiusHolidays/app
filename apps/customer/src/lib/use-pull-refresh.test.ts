import { act, renderHook } from '@testing-library/react-native';

import { MIN_SPIN_MS, usePullRefresh } from './use-pull-refresh';

jest.mock('./haptic', () => ({ haptic: jest.fn() }));
const { haptic } = jest.requireMock<{ haptic: jest.Mock }>('./haptic');

describe('usePullRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    haptic.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('taps once when the pull lets go and spins until the live answer is confirmed', async () => {
    const { result } = await renderHook(() => usePullRefresh(true));
    await act(async () => result.current.onRefresh());
    expect(haptic).toHaveBeenCalledWith('light');
    expect(result.current.refreshing).toBe(true);
    await act(async () => jest.advanceTimersByTime(MIN_SPIN_MS));
    expect(result.current.refreshing).toBe(false);
  });

  it('keeps spinning while the connection has not answered, and stops when it does', async () => {
    const { rerender, result } = await renderHook(({ live }: { live: boolean }) => usePullRefresh(live), { initialProps: { live: false } });
    await act(async () => result.current.onRefresh());
    await act(async () => jest.advanceTimersByTime(MIN_SPIN_MS));
    expect(result.current.refreshing).toBe(true);
    await rerender({ live: true });
    expect(result.current.refreshing).toBe(false);
  });

  it('never spins for ever: offline it gives up after a few seconds', async () => {
    const { result } = await renderHook(() => usePullRefresh(false));
    await act(async () => result.current.onRefresh());
    await act(async () => jest.advanceTimersByTime(4000));
    expect(result.current.refreshing).toBe(false);
  });
});
