import { staffTheme, ThemeProvider } from '@citius/ui';
import { act, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { originalCoverUri } from '@/features/trips/cover';
import { renderWithTheme } from '@/test/render';

import { DestinationCover } from './destination-cover';

const mockSession = { gate: { kind: 'staff', offline: false }, online: true };
jest.mock('@/features/gate/session', () => ({ useStaffSession: () => mockSession }));
jest.mock('expo-image', () => {
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: 'cover-image' }) };
});

const bali = { path: '/images/bali.jpg', placeholder: 'L00000fQfQfQfQfQfQfQfQfQfQfQ' };
const rome = { path: '/images/rome.jpg', placeholder: 'L00000fQfQfQfQfQfQfQfQfQfQfQ' };

type ImageProps = { onError?: () => void; source: { uri: string } };
/** The full photo layer (the second image), or null when the ladder has run out. */
const fullPhoto = () => {
  const images = screen.queryAllByTestId('cover-image', { includeHiddenElements: true });
  const full = images.at(1);
  return full ? (full.props as ImageProps) : null;
};

const metrics = { frame: { height: 844, width: 390, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 47 } };
function Cover({ photo }: { photo: typeof bali }) {
  return <DestinationCover photo={photo} />;
}
const themed = (photo: typeof bali) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider theme={staffTheme}>
      <Cover photo={photo} />
    </ThemeProvider>
  </SafeAreaProvider>
);

describe('destination cover', () => {
  beforeEach(() => {
    mockSession.online = true;
  });

  it('falls back to the original, then to the preview alone, when the photo will not load', async () => {
    await renderWithTheme(<Cover photo={bali} />);
    expect(fullPhoto()?.source.uri).toContain(encodeURIComponent(bali.path));
    await act(async () => fullPhoto()?.onError?.());
    expect(fullPhoto()?.source.uri).toBe(originalCoverUri(bali.path));
    await act(async () => fullPhoto()?.onError?.());
    expect(fullPhoto()).toBeNull();
  });

  it("starts another trip's photo from the top, even after one failed", async () => {
    const view = await renderWithTheme(<Cover photo={bali} />);
    await act(async () => fullPhoto()?.onError?.());
    await act(async () => fullPhoto()?.onError?.());
    expect(fullPhoto()).toBeNull();
    await view.rerender(themed(rome));
    expect(fullPhoto()?.source.uri).toContain(encodeURIComponent(rome.path));
  });

  it('tries the photo again when signal comes back', async () => {
    mockSession.online = false;
    const view = await renderWithTheme(<Cover photo={bali} />);
    await act(async () => fullPhoto()?.onError?.());
    await act(async () => fullPhoto()?.onError?.());
    expect(fullPhoto()).toBeNull();
    mockSession.online = true;
    await view.rerender(themed(bali));
    expect(fullPhoto()?.source.uri).toContain(encodeURIComponent(bali.path));
  });
});
