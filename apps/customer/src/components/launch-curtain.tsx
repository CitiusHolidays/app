import { citius } from '@citius/ui';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { createContext, type ReactNode, use, useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Screen, ScreenContainer } from 'react-native-screens';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * The splash mark split into its two planes, each on the mark's full canvas so that, at rest, the
 * pair is pixel for pixel the native splash. iOS draws its splash colours as Display P3, so the
 * iOS copies carry that profile; otherwise the hand-off would show a shift in colour.
 */
const PLANES =
  Platform.OS === 'ios'
    ? {
        green: require('../../assets/images/launch-plane-green-p3.png'),
        orange: require('../../assets/images/launch-plane-orange-p3.png'),
      }
    : {
        green: require('../../assets/images/launch-plane-green.png'),
        orange: require('../../assets/images/launch-plane-orange.png'),
      };
/**
 * The website footer's travel doodles, byte for byte (`public/gallery/bgfooter.webp`): grey
 * line art at about 7% alpha on transparent, 1919 x 956 pixels.
 */
const texture = require('../../assets/images/launch-texture.webp');
const TEXTURE_PX = { height: 956, width: 1919 };
/**
 * The file's own alpha is too faint on a phone, so it is drawn this many times over itself,
 * which roughly multiplies its strength (the owner's call: about twice).
 */
export const TEXTURE_LAYERS = 2;

/**
 * Matches the native splash in app.json: Citius blue (#102a83), the planes 180 points wide,
 * centred. On iOS that blue is drawn as Display P3, which is #032b88 in sRGB.
 */
const SPLASH_BLUE = Platform.OS === 'ios' ? '#032b88' : citius.blue;
const PLANES_SIZE = 180;
const TEXTURE_IN_MS = 420;
const CURTAIN_OUT_MS = 320;
/** The planes' hover while the app loads: a slow breath, a few points each way. */
const HOVER_MS = 1600;
const HOVER_PT = 4;
/** Takeoff: the orange plane leads, the green follows; the blue fades out under them. */
const TAKEOFF_MS = 720;
const FOLLOW_MS = 90;
const CURTAIN_OUT_DELAY_MS = 160;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** Gathers speed and is off screen before it would slow down. */
const EASE_TAKEOFF = Easing.bezier(0.6, 0, 0.4, 1);
/** If the texture never reports loaded, the native splash still goes after this long. */
const NATIVE_SPLASH_LIMIT_MS = 1500;

const LaunchContext = createContext<() => void>(() => undefined);

/** Call once the first real screen (or an error screen) is ready to be shown. */
export function useLaunchDone() {
  return use(LaunchContext);
}

/**
 * The loading screen. It takes over from the native splash (a flat blue with the planes, all that
 * Android 12+ allows) with the planes in exactly the same place and fades the website's doodle
 * texture in. The planes hover while the app loads; once its first screen is ready they take off,
 * and the blue fades out under them so they fly away over that screen.
 */
export function LaunchCurtain({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const markReady = useMemo(() => () => setReady(true), []);
  return (
    <LaunchContext value={markReady}>
      {children}
      <Curtain ready={ready} />
    </LaunchContext>
  );
}

/**
 * White status bar icons over the blue, as on the native splash. iOS takes the style only from a
 * native screen (this app uses view-controller-based status bars); Android from StatusBar.
 */
function LightStatusBar({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'ios') {
    return (
      <>
        <StatusBar style="light" />
        {children}
      </>
    );
  }
  return (
    <ScreenContainer pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Screen activityState={2} pointerEvents="box-none" statusBarStyle="light" style={StyleSheet.absoluteFill}>
        {children}
      </Screen>
    </ScreenContainer>
  );
}

/**
 * The doodles tiled at their native size: one image pixel per screen pixel, never enlarged,
 * repeated to fill the screen, composited over the blue as they are.
 */
function Doodles({ onReady }: { onReady: () => void }) {
  const { height, width } = useWindowDimensions();
  const scale = PixelRatio.get();
  const tile = { height: TEXTURE_PX.height / scale, width: TEXTURE_PX.width / scale };
  const columns = Math.ceil(width / tile.width);
  const rows = Math.ceil(height / tile.height);
  const tiles = Array.from({ length: TEXTURE_LAYERS * rows * columns }, (_, index) => {
    const cell = index % (rows * columns);
    return { key: `${index}`, left: (cell % columns) * tile.width, top: Math.floor(cell / columns) * tile.height };
  });
  return tiles.map(({ key, left, top }) => (
    <Image
      contentFit="fill"
      key={key}
      onDisplay={key === '0' ? onReady : undefined}
      onError={key === '0' ? onReady : undefined}
      source={texture}
      style={[styles.tile, { height: tile.height, left, top, width: tile.width }]}
    />
  ));
}

function hideNativeSplash() {
  void SplashScreen.hideAsync().catch(() => undefined);
}

/** One plane, on the mark's canvas: hovering while the app loads, then climbing away. */
function Plane({
  climb,
  flight,
  hover,
  source,
  sway,
}: {
  climb: number;
  flight: { get: () => number };
  hover: { get: () => number };
  source: number;
  sway: number;
}) {
  const { height, width } = useWindowDimensions();
  const style = useAnimatedStyle(() => {
    const f = flight.get();
    // Along the nose (up and to the right), climbing more steeply as it goes, nose lifting.
    const x = interpolate(f, [0, 0.5, 1], [0, width * 0.34, width * 0.95]);
    const y = interpolate(f, [0, 0.5, 1], [0, -height * 0.1, -height * climb]);
    const breathe = (1 - f) * hover.get();
    return {
      transform: [
        { translateX: x + breathe * sway },
        { translateY: y - breathe * HOVER_PT },
        { rotate: `${interpolate(f, [0, 1], [0, -7])}deg` },
        { scale: interpolate(f, [0, 1], [1, 0.78]) },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.centre, style]}>
      <Image contentFit="contain" source={source} style={styles.planes} />
    </Animated.View>
  );
}

function Curtain({ ready }: { ready: boolean }) {
  const reduced = useReducedMotion();
  const textureOpacity = useSharedValue(0);
  const groundOpacity = useSharedValue(1);
  const planesOpacity = useSharedValue(1);
  const hover = useSharedValue(0);
  const orangeFlight = useSharedValue(0);
  const greenFlight = useSharedValue(0);
  const [textureShown, setTextureShown] = useState(false);
  const [gone, setGone] = useState(false);
  const handedOff = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      hideNativeSplash();
      setTextureShown(true);
    }, NATIVE_SPLASH_LIMIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const onTextureReady = () => {
    if (handedOff.current) return;
    handedOff.current = true;
    // The curtain already matches the native splash, so the hand-off can't be seen; the texture
    // then fades in over the blue.
    hideNativeSplash();
    if (reduced) {
      textureOpacity.set(1);
      setTextureShown(true);
      return;
    }
    textureOpacity.set(
      withTiming(1, { duration: TEXTURE_IN_MS }, (finished) => {
        if (finished) scheduleOnRN(setTextureShown, true);
      })
    );
  };

  // While the app is still loading, the planes hover: the wait reads as the app at work.
  useEffect(() => {
    if (reduced || !textureShown || ready) return;
    hover.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: HOVER_MS / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(-1, { duration: HOVER_MS, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: HOVER_MS / 2, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
  }, [hover, ready, reduced, textureShown]);

  // Leave once the app is ready and the texture has finished arriving (no half-faded flash): the
  // planes take off and the blue fades out under them, so they fly over the first screen.
  useEffect(() => {
    if (!ready || !textureShown) return;
    if (reduced) {
      // Fewer and gentler: no flight, the whole curtain simply fades.
      planesOpacity.set(withTiming(0, { duration: CURTAIN_OUT_MS, easing: EASE_OUT }));
      groundOpacity.set(
        withTiming(0, { duration: CURTAIN_OUT_MS, easing: EASE_OUT }, (finished) => {
          if (finished) scheduleOnRN(setGone, true);
        })
      );
      return;
    }
    orangeFlight.set(withTiming(1, { duration: TAKEOFF_MS, easing: EASE_TAKEOFF }));
    greenFlight.set(
      withDelay(
        FOLLOW_MS,
        withTiming(1, { duration: TAKEOFF_MS, easing: EASE_TAKEOFF }, (finished) => {
          if (finished) scheduleOnRN(setGone, true);
        })
      )
    );
    groundOpacity.set(withDelay(CURTAIN_OUT_DELAY_MS, withTiming(0, { duration: CURTAIN_OUT_MS, easing: EASE_OUT })));
  }, [greenFlight, groundOpacity, orangeFlight, planesOpacity, ready, reduced, textureShown]);

  const groundStyle = useAnimatedStyle(() => ({ opacity: groundOpacity.get() }));
  const textureStyle = useAnimatedStyle(() => ({ opacity: textureOpacity.get() }));
  const planesStyle = useAnimatedStyle(() => ({ opacity: planesOpacity.get() }));

  if (gone) return null;
  return (
    <View
      accessibilityLabel="Citius"
      accessible
      pointerEvents={ready ? 'none' : 'auto'}
      style={StyleSheet.absoluteFill}
    >
      <LightStatusBar>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.curtain, groundStyle]}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, textureStyle]}>
            <Doodles onReady={onTextureReady} />
          </Animated.View>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, planesStyle]}>
          {/* The green plane sits behind the orange one, as in the mark. */}
          <Plane climb={0.78} flight={greenFlight} hover={hover} source={PLANES.green} sway={-1.5} />
          <Plane climb={0.66} flight={orangeFlight} hover={hover} source={PLANES.orange} sway={1.5} />
        </Animated.View>
      </LightStatusBar>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  curtain: { backgroundColor: SPLASH_BLUE },
  planes: { height: PLANES_SIZE, width: PLANES_SIZE },
  tile: { position: 'absolute' },
});
