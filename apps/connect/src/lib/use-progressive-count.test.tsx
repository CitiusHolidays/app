import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FIRST_ROWS, ROWS_PER_FRAME, useProgressiveCount } from './use-progressive-count';

function Probe({ total }: { total: number }) {
  return <Text>{`shown:${useProgressiveCount(total)}`}</Text>;
}

describe('useProgressiveCount', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('draws a short list at once', async () => {
    await render(<Probe total={12} />);
    expect(screen.getByText('shown:12')).toBeOnTheScreen();
  });

  it('draws the first screens of a long list at once, then the rest a frame at a time', async () => {
    await render(<Probe total={300} />);
    expect(screen.getByText(`shown:${FIRST_ROWS}`)).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(16);
    });
    expect(screen.getByText(`shown:${FIRST_ROWS + ROWS_PER_FRAME}`)).toBeOnTheScreen();
    for (let frame = 0; frame < 10; frame += 1) {
      await act(async () => {
        jest.advanceTimersByTime(16);
      });
    }
    expect(screen.getByText('shown:300')).toBeOnTheScreen();
  });

  it('shows everything at once when the list shrinks', async () => {
    const view = await render(<Probe total={300} />);
    await view.rerender(<Probe total={5} />);
    expect(screen.getByText('shown:5')).toBeOnTheScreen();
  });
});
