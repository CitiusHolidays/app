import type { TripDetail } from '@citius/backend/customer';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { renderWithTheme } from '@/test/render';

import { FamilyCard } from './family-card';

const mockSetConsent = jest.fn();
jest.mock('convex/react', () => ({ useMutation: () => mockSetConsent }));
jest.mock('@/lib/haptic', () => ({ haptic: jest.fn() }));
jest.mock('@/lib/safe-log', () => ({ logEvent: jest.fn() }));
jest.mock('@/i18n/i18n', () => {
  const { en } = jest.requireActual('@/i18n/locales/en');
  const t = (key: string, vars: Record<string, string> = {}) =>
    (en[key] as string).replace(/\{(\w+)\}/g, (_match: string, name: string) => vars[name] ?? '');
  return { useI18n: () => ({ t }) };
});

const detail = {
  minors: [
    { consent: 'none', fullName: 'Ravi Testguest', travellerId: 'ravi' },
    { consent: 'none', fullName: 'Meera Testguest', travellerId: 'meera' },
  ],
} as unknown as TripDetail;

/** Each request waits until the test answers it. */
function deferred() {
  const answers: { reject: (error: Error) => void; resolve: () => void }[] = [];
  mockSetConsent.mockImplementation(() => new Promise<void>((resolve, reject) => answers.push({ reject, resolve })));
  return answers;
}

const buttons = () => screen.getAllByRole('button', { name: 'Give consent' });

describe('family card', () => {
  beforeEach(() => {
    mockSetConsent.mockReset();
    // Confirms each alert with its action, as the traveller would.
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, actions) => actions?.[1]?.onPress?.());
  });

  it('keeps each child spinning until the consent for that child is saved', async () => {
    const answers = deferred();
    await renderWithTheme(<FamilyCard detail={detail} tripId="trip-1" />);
    await fireEvent.press(buttons()[0]!);
    await fireEvent.press(buttons()[1]!);
    expect(buttons().map((button) => button.props.accessibilityState.busy)).toEqual([true, true]);
    await act(async () => answers[0]!.resolve());
    expect(buttons().map((button) => button.props.accessibilityState.busy)).toEqual([false, true]);
  });

  it('keeps a failure in view while another child is saved', async () => {
    const answers = deferred();
    await renderWithTheme(<FamilyCard detail={detail} tripId="trip-1" />);
    await fireEvent.press(buttons()[0]!);
    await act(async () => answers[0]!.reject(new Error('offline')));
    expect(screen.getByText('Your consent could not be saved. Try again.')).toBeOnTheScreen();
    await fireEvent.press(buttons()[1]!);
    await act(async () => answers[1]!.resolve());
    expect(screen.getByText('Your consent could not be saved. Try again.')).toBeOnTheScreen();
    expect(mockSetConsent).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'granted', minorTravellerId: 'meera', tripId: 'trip-1' }));
  });

  it('clears the failure for a child once a retry goes through', async () => {
    const answers = deferred();
    await renderWithTheme(<FamilyCard detail={detail} tripId="trip-1" />);
    await fireEvent.press(buttons()[0]!);
    await act(async () => answers[0]!.reject(new Error('offline')));
    await fireEvent.press(buttons()[0]!);
    await act(async () => answers[1]!.resolve());
    expect(screen.queryByText('Your consent could not be saved. Try again.')).toBeNull();
  });
});
