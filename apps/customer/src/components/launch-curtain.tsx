import { citius } from '@citius/ui';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { createContext, type ReactNode, use, useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Screen, ScreenContainer } from 'react-native-screens';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * iOS draws its splash colours as Display P3, so the iOS copy of the planes carries that profile
 * and the blue is given in P3; otherwise the hand-off would show a shift in colour.
 */
const planes =
  Platform.OS === 'ios' ? require('../../assets/images/launch-planes-p3.png') : require('../../assets/images/splash-icon.png');
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
const CURTAIN_OUT_MS = 260;
/** If the texture never reports loaded, the native splash still goes after this long. */
const NATIVE_SPLASH_LIMIT_MS = 1500;

const LaunchContext = createContext<() => void>(() => undefined);

/** Call once the first real screen (or an error screen) is ready to be shown. */
export function useLaunchDone() {
  return use(LaunchContext);
}

/**
 * The loading screen. It takes over from the native splash (a flat blue with the planes, all that
 * Android 12+ allows) with the planes in exactly the same place, fades the website's doodle
 * texture in, and fades away once the app says its first screen is ready.
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

function Curtain({ ready }: { ready: boolean }) {
  const reduced = useReducedMotion();
  const textureOpacity = useSharedValue(0);
  const curtainOpacity = useSharedValue(1);
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

  // Leave once the app is ready and the texture has finished arriving (no half-faded flash).
  useEffect(() => {
    if (!ready || !textureShown || reduced) return;
    curtainOpacity.set(
      withTiming(0, { duration: CURTAIN_OUT_MS }, (finished) => {
        if (finished) scheduleOnRN(setGone, true);
      })
    );
  }, [curtainOpacity, ready, reduced, textureShown]);

  const curtainStyle = useAnimatedStyle(() => ({ opacity: curtainOpacity.get() }));
  const textureStyle = useAnimatedStyle(() => ({ opacity: textureOpacity.get() }));

  // With reduced motion the curtain simply goes.
  if (gone || (reduced && ready && textureShown)) return null;
  return (
    <Animated.View
      accessibilityLabel="Citius"
      accessible
      pointerEvents={ready ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.curtain, curtainStyle]}
    >
      <LightStatusBar>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, textureStyle]}>
          <Doodles onReady={onTextureReady} />
        </Animated.View>
        <View pointerEvents="none" style={styles.centre}>
          <Image contentFit="contain" source={planes} style={styles.planes} />
        </View>
      </LightStatusBar>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  centre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  curtain: { backgroundColor: SPLASH_BLUE },
  planes: { height: PLANES_SIZE, width: PLANES_SIZE },
  tile: { position: 'absolute' },
});
