// Reanimated 4.7's own mock initialises the native CSS runtime and throws under Jest, so the app
// tests use a minimal stand-in for the three exports the UI package uses. Motion is checked on
// device, not in unit tests.
jest.mock('react-native-reanimated', () => {
  const { Fragment } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  // Layout-animation builders chain (FadeInUp.duration(160).easing(...)); any call returns the builder.
  const builder: Record<string, unknown> = new Proxy({}, { get: () => () => builder });
  return {
    __esModule: true,
    cubicBezier: () => 'ease-out',
    default: { View },
    Easing: { bezier: () => () => 0 },
    FadeIn: builder,
    FadeInDown: builder,
    FadeInUp: builder,
    FadeOut: builder,
    FadeOutDown: builder,
    LinearTransition: builder,
    ZoomIn: builder,
    Keyframe: class {
      duration() {
        return this;
      }
    },
    LayoutAnimationConfig: Fragment,
    useAnimatedStyle: (factory: () => object) => factory(),
    useReducedMotion: () => false,
    useSharedValue: (initial: number) => {
      let value = initial;
      return { get: () => value, set: (next: number) => (value = typeof next === 'number' ? next : value) };
    },
    withSequence: () => 0,
    withTiming: () => 0,
  };
});
// The keyboard controller's own Jest mock: plain ScrollView stand-ins, no native module.
jest.mock('react-native-keyboard-controller', () => jest.requireActual('react-native-keyboard-controller/jest'));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Error: 'error', Success: 'success' },
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, LinearGradient: View };
});
// The native PDF view (react-native-pdf, with react-native-blob-util under it) is not in Jest.
// A plain view stands in for it; tests that check its props mock it themselves.
jest.mock('react-native-pdf', () => {
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: () => createElement(View, { testID: 'native-pdf' }) };
});
jest.mock('react-native-blob-util', () => ({ __esModule: true, default: { fs: { dirs: {} } } }));
