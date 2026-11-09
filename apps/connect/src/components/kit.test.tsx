import { fireEvent, screen } from '@testing-library/react-native';
import { Linking, StyleSheet } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { renderWithTheme } from '@/test/render';

import { CallButton, Row, TickStrip } from './kit';

/** VoiceOver treats an `accessible` view as one element and skips everything inside it. */
type Node = ReturnType<typeof screen.getByRole>;

function insideAccessibleAncestor(node: Node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.props.accessible === true) return true;
  }
  return false;
}

describe('Row', () => {
  it('keeps a nested Call button reachable by VoiceOver when the row itself is not a button', async () => {
    await renderWithTheme(
      <Row subtitle="Bus 1" title="Asha Example" trailing={<CallButton name="Asha Example" phone="+919000000000" />} />
    );
    const call = screen.getByRole('button', { name: 'Call Asha Example' });
    expect(insideAccessibleAncestor(call)).toBe(false);
    expect(screen.getByLabelText('Asha Example, Bus 1')).toBeOnTheScreen();
  });

  it('reads a plain row as one element with its own label', async () => {
    await renderWithTheme(<Row accessibilityLabel="Client A, 4 Nov – 10 Nov" title="Client A" />);
    expect(screen.getByLabelText('Client A, 4 Nov – 10 Nov')).toBeOnTheScreen();
  });
});

describe('CallButton', () => {
  it('dials only the digits and + of a number typed with spaces, dashes and notes', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderWithTheme(<CallButton name="Asha Example" phone="+91 90000-00000 (mobile)" />);
    fireEvent.press(screen.getByRole('button', { name: 'Call Asha Example' }));
    expect(openURL).toHaveBeenCalledWith('tel:+919000000000');
    openURL.mockRestore();
  });
});

describe('TickStrip', () => {
  const delays = () =>
    screen
      .getByLabelText('60 of 60 marked here')
      .children.map((tick) => (StyleSheet.flatten((tick as Node).props.style) as { transitionDelay?: number }).transitionDelay ?? 0);

  it('turns a full group green in one sweep of under 300 ms, however many ticks there are', async () => {
    await renderWithTheme(<TickStrip marked={60} total={60} />);
    // Was 12 ms a tick: 708 ms for 60 ticks.
    expect(Math.max(...delays())).toBe(240);
    expect(delays()[0]).toBe(0);
  });

  it('turns every tick at once under reduced motion', async () => {
    const reduced = jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    await renderWithTheme(<TickStrip marked={60} total={60} />);
    expect(new Set(delays())).toEqual(new Set([0]));
    reduced.mockRestore();
  });
});
