import { citius } from '@citius/ui';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { createContext, type ReactNode, use, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Screen, ScreenContainer } from 'react-native-screens';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * iOS draws its splash colours as Display P3, so the iOS copy of the planes carries that profile
 * and the blue is given in P3; otherwise the hand-off would show a shift in colour.
 */
const planes =
  Platform.OS === 'ios' ? require('../../assets/images/launch-planes-p3.png') : require('../../assets/images/splash-icon.png');
/** The website footer's travel doodles (`public/gallery/bgfooter.webp`) as a one-colour mask. */
const texture = require('../../assets/images/launch-texture.webp');

/**
 * Matches the native splash in app.json: Citius blue (#102a83), the planes 180 points wide,
 * centred. On iOS that blue is drawn as Display P3, which is #032b88 in sRGB.
 */
const SPLASH_BLUE = Platform.OS === 'ios' ? '#032b88' : citius.blue;
const PLANES_SIZE = 180;
/** How strongly the doodles darken the blue (the website multiplies them over its dark ground). */
export const TEXTURE_OPACITY = 0.17;
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
      textureOpacity.set(TEXTURE_OPACITY);
      setTextureShown(true);
      return;
    }
    textureOpacity.set(
      withTiming(TEXTURE_OPACITY, { duration: TEXTURE_IN_MS }, (finished) => {
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
          <Image
            contentFit="cover"
            onDisplay={onTextureReady}
            onError={onTextureReady}
            source={texture}
            style={StyleSheet.absoluteFill}
            tintColor="#000000"
          />
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
});
