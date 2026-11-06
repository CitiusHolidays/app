import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AppStoreProvider } from '@/lib/app-store';

import { useHeadcount } from './use-headcount';

jest.mock('@/lib/storage/device-store', () => ({
  openDeviceStore: async () => jest.requireActual('@/lib/storage/memory-store').createMemoryStore(),
}));

const wrapper = ({ children }: { children: ReactNode }) => <AppStoreProvider fallback={null}>{children}</AppStoreProvider>;

describe('useHeadcount', () => {
  afterEach(() => jest.useRealTimers());

  it('moves to a fresh day at midnight without the screen being reopened', async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 6, 23, 59, 30) });
    const { result } = await renderHook(() => useHeadcount('jc_test_1'), { wrapper });
    await waitFor(() => expect(result.current.state?.day).toBe('2026-11-06'));
    await act(async () => result.current.toggle('t_1'));
    expect(result.current.state?.stops[0]?.present).toEqual(['t_1']);

    await act(async () => {
      jest.advanceTimersByTime(2 * 60_000);
    });
    await waitFor(() => expect(result.current.state?.day).toBe('2026-11-07'));
    expect(result.current.state?.stops[0]?.present).toEqual([]);
  });
});
