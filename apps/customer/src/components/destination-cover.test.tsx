import type { DestinationPhoto } from '@citius/backend/customer';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme, themed } from '@/test/render';

import { DestinationCover } from './destination-cover';

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
jest.mock('@/lib/env', () => ({ WEBSITE_URL: 'https://site.test' }));
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return {
    // Each layer shows up under the address it loads, and can be made to fail.
    Image: ({ onError, source }: { onError?: () => void; source: { uri?: string } | number }) =>
      typeof source === 'number' ? null : <View onError={onError} testID={source.uri} />,
  };
});

const bali: DestinationPhoto = { path: '/images/bali.jpg', placeholder: 'L00000fQfQfQfQfQfQfQfQfQfQfQ' } as DestinationPhoto;
const goa: DestinationPhoto = { path: '/images/goa.jpg', placeholder: 'L00000fQfQfQfQfQfQfQfQfQfQfQ' } as DestinationPhoto;

const sharp = (photo: DestinationPhoto) => `https://site.test/_next/image?url=${encodeURIComponent(photo.path)}&w=640&q=85`;
const original = (photo: DestinationPhoto) => `https://site.test${photo.path}`;

const preview = (photo: DestinationPhoto) => `https://site.test/_next/image?url=${encodeURIComponent(photo.path)}&w=96&q=85`;

// The cover is hidden from screen readers, so every query looks past that.
const hidden = { includeHiddenElements: true };
const layer = (uri: string) => screen.queryByTestId(uri, hidden);

/** Renders the cover and gives it a 320pt width, so it asks for the sharp photo (640 px at 2x). */
async function laidOut(photo: DestinationPhoto) {
  await renderWithTheme(<DestinationCover photo={photo} />);
  await fireEvent(screen.getByTestId(preview(photo), hidden), 'layout', { nativeEvent: { layout: { height: 200, width: 320 } } });
}

const fail = (uri: string) => act(async () => fireEvent(screen.getByTestId(uri, hidden), 'error'));

describe('destination cover', () => {
  beforeEach(() => {
    mockNetwork.isConnected = true;
    mockNetwork.isInternetReachable = true;
  });

  it('tries the original file, then the preview, when the sharp photo will not load online', async () => {
    await laidOut(bali);
    await fail(sharp(bali));
    expect(layer(original(bali))).toBeOnTheScreen();
    await fail(original(bali));
    expect(layer(original(bali))).toBeNull();
    expect(layer(sharp(bali))).toBeNull();
  });

  it('keeps asking for the sharp photo when a load fails offline', async () => {
    mockNetwork.isConnected = false;
    await laidOut(bali);
    await fail(sharp(bali));
    expect(layer(sharp(bali))).toBeOnTheScreen();
  });

  it('starts sharp again when the phone comes back online', async () => {
    await laidOut(bali);
    await fail(sharp(bali));
    await fail(original(bali));
    mockNetwork.isConnected = false;
    await screen.rerender(themed(<DestinationCover photo={bali} />));
    mockNetwork.isConnected = true;
    await screen.rerender(themed(<DestinationCover photo={bali} />));
    expect(layer(sharp(bali))).toBeOnTheScreen();
  });

  it('starts sharp when the cover moves on to another trip', async () => {
    await laidOut(bali);
    await fail(sharp(bali));
    await screen.rerender(themed(<DestinationCover photo={goa} />));
    expect(layer(sharp(goa))).toBeOnTheScreen();
  });
});
