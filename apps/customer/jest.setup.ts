// Reanimated 4.7's own mock initialises the native CSS runtime and throws under Jest, so the app
// tests use a stand-in for the exports the app touches: entrance builders chain to themselves,
// animated components are plain ones, and animations jump to their end. Motion is checked on device.
jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual('react-native');
  const chain: object = new Proxy({}, { get: () => () => chain });
  const curve = () => () => 0;
  return {
    __esModule: true,
    cancelAnimation: () => undefined,
    cubicBezier: () => 'ease-out',
    default: { FlatList: RN.FlatList, ScrollView: RN.ScrollView, Text: RN.Text, View: RN.View },
    Easing: { bezier: curve, ease: () => 0, in: curve, inOut: curve, linear: () => 0, out: curve },
    FadeIn: chain,
    FadeInDown: chain,
    FadeInRight: chain,
    FadeOut: chain,
    LayoutAnimationConfig: ({ children }: { children: unknown }) => children,
    useAnimatedScrollHandler: () => () => undefined,
    useAnimatedStyle: (style: () => object) => style(),
    useReducedMotion: () => false,
    useSharedValue: (initial: unknown) => {
      let value = initial;
      return { get: () => value, set: (next: unknown) => (value = next) };
    },
    withDelay: (_delay: number, animation: unknown) => animation,
    withRepeat: (animation: unknown) => animation,
    withSequence: (...animations: unknown[]) => animations[animations.length - 1],
    withSpring: (to: unknown) => to,
    withTiming: (to: unknown) => to,
  };
});
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));
jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Error: 'error', Success: 'success' },
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-IN' }],
}));
