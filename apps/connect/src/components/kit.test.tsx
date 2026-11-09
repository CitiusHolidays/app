import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { renderWithTheme } from '@/test/render';

import { CallButton, Row } from './kit';

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
