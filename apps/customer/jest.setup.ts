// Reanimated 4.7's own mock initialises the native CSS runtime and throws under Jest, so the app
// tests use a minimal stand-in for the exports the UI package uses. Motion is checked on device.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    cubicBezier: () => 'ease-out',
    default: { View },
    useReducedMotion: () => false,
  };
});
jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Error: 'error', Success: 'success' },
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-IN' }],
}));
