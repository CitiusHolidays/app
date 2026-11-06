import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button, StatusPill, Text, ThemeProvider } from './primitives';
import { staffTheme } from './tokens';

const themed = async (node: React.ReactElement) => render(<ThemeProvider theme={staffTheme}>{node}</ThemeProvider>);

describe('ui primitives', () => {
  it('exposes a labelled button and treats busy as disabled', async () => {
    const onPress = jest.fn();
    await themed(<Button busy label="Save expense" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Save expense' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('presses an enabled button', async () => {
    const onPress = jest.fn();
    await themed(<Button label="Sign in" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('gives status words, not only colour', async () => {
    await themed(<StatusPill kind="attention" label="No response" />);
    expect(screen.getByLabelText('No response')).toBeOnTheScreen();
  });

  it('caps only the answer figure for Dynamic Type', async () => {
    await themed(
      <>
        <Text variant="answer">12 of 14 here</Text>
        <Text>Body</Text>
      </>
    );
    expect(screen.getByText('12 of 14 here').props.maxFontSizeMultiplier).toBe(1.5);
    expect(screen.getByText('Body').props.maxFontSizeMultiplier).toBeUndefined();
  });
});
