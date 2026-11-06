import { fireEvent, screen } from '@testing-library/react-native';
import { ConvexError } from 'convex/values';
import { Text } from 'react-native';

import { renderWithTheme } from '@/test/render';

import { AppErrorBoundary, isAccessRevokedError } from './error-boundary';

let mockThrow: Error | null = null;
function Child() {
  if (mockThrow) throw mockThrow;
  return <Text>Trip screen</Text>;
}

describe('app error boundary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockThrow = null;
  });
  afterEach(() => jest.restoreAllMocks());

  it('recognises an access refusal from the server', () => {
    expect(isAccessRevokedError(new ConvexError('FORBIDDEN'))).toBe(true);
    expect(isAccessRevokedError(new ConvexError('NOT_STAFF'))).toBe(true);
    expect(isAccessRevokedError(new ConvexError('Job card not found'))).toBe(false);
    expect(isAccessRevokedError(new TypeError('Network request failed'))).toBe(false);
  });

  it('shows a screen instead of crashing, wipes local data on FORBIDDEN, and offers sign-out', async () => {
    mockThrow = new ConvexError('FORBIDDEN');
    const onRevoked = jest.fn(async () => undefined);
    const onSignOut = jest.fn(async () => undefined);
    await renderWithTheme(
      <AppErrorBoundary onRevoked={onRevoked} onSignOut={onSignOut}>
        <Child />
      </AppErrorBoundary>
    );
    expect(screen.getByText('Your access has changed')).toBeOnTheScreen();
    expect(onRevoked).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('lets the person try again after an ordinary error, without wiping anything', async () => {
    mockThrow = new Error('render failed');
    const onRevoked = jest.fn(async () => undefined);
    await renderWithTheme(
      <AppErrorBoundary onRevoked={onRevoked} onSignOut={async () => undefined}>
        <Child />
      </AppErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    expect(onRevoked).not.toHaveBeenCalled();
    mockThrow = null;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Trip screen')).toBeOnTheScreen();
  });
});
