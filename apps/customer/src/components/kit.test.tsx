import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { renderWithTheme } from '@/test/render';

import { CallButton } from './kit';

jest.mock('@/components/motion-views', () => {
  const { View } = jest.requireActual('react-native');
  return { Pop: View, Rise: View };
});

describe('CallButton', () => {
  it('dials only the digits and + of a number typed with spaces, dashes and notes', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderWithTheme(<CallButton label="Call Asha" phone="+91 90000-00000 (mobile)" />);
    fireEvent.press(screen.getByRole('button', { name: 'Call Asha' }));
    expect(openURL).toHaveBeenCalledWith('tel:+919000000000');
    openURL.mockRestore();
  });
});
