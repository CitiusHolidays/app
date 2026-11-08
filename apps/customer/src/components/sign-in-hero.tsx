import { space, Text, useAppTheme } from '@citius/ui';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/kit';
import { useI18n } from '@/i18n/i18n';
import { type Artwork, HALLSTATT, SHEET_OVERLAP, SIGN_IN_ARTWORK } from '@/features/auth/sign-in-artwork';

/** One artwork per launch, as the website picks one per visit. */
const artwork: Artwork = SIGN_IN_ARTWORK[Math.floor(Math.random() * SIGN_IN_ARTWORK.length)] ?? HALLSTATT;
const planes = require('../../assets/images/splash-icon.png');

/** The photograph's slow settle: it starts this much larger and eases to rest once. */
const DRIFT_SCALE = 1.06;
const DRIFT_MS = 9000;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const titleEntering = FadeInDown.duration(420).delay(120).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 14 }] });

/**
 * The sign-in's header, after the website's sign-in and the owner's "Places" reference: a
 * destination fills the top of the screen edge to edge, with the planes, the serif title and the
 * place's name on its darkened foot.
 */
export function SignInHero({ intro }: { intro: string }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const drift = useSharedValue(reduced ? 1 : DRIFT_SCALE);
  useEffect(() => {
    if (reduced) return;
    drift.set(withTiming(1, { duration: DRIFT_MS, easing: EASE_OUT }));
  }, [drift, reduced]);
  const driftStyle = useAnimatedStyle(() => ({ transform: [{ scale: drift.get() }] }));
  const heroHeight = Math.min(Math.max(height * 0.56, 400), 600);

  return (
    <View style={{ backgroundColor: theme.color.dark, height: heroHeight, overflow: 'hidden' }}>
      <Animated.View importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, driftStyle]}>
        <Image accessible={false} contentFit="cover" priority="high" source={artwork.source} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <LinearGradient
        colors={['rgba(11,16,38,0.45)', 'rgba(11,16,38,0)', 'rgba(11,16,38,0.35)', 'rgba(11,16,38,0.9)']}
        locations={[0, 0.26, 0.55, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          flex: 1,
          justifyContent: 'space-between',
          paddingBottom: SHEET_OVERLAP + space.xl,
          paddingHorizontal: theme.frame + space.xs,
          paddingTop: insets.top + space.md,
        }}
      >
        <Image accessible={false} contentFit="contain" source={planes} style={{ height: 64, marginLeft: -18, width: 100 }} />
        <Animated.View entering={titleEntering} style={{ gap: space.sm }}>
          <Text tone="onDarkMuted" variant="mono">
            {t('signIn.kicker')}
          </Text>
          <Text accessibilityRole="header" tone="onDark" variant="display">
            {t('signIn.title')}
          </Text>
          <Text tone="onDarkMuted">{intro}</Text>
          <View accessible style={{ alignItems: 'center', flexDirection: 'row', gap: space.xs, marginTop: space.xs }}>
            <Icon color={theme.color.onDarkMuted} ios="mappin" md="location_on" size={14} />
            <Text tone="onDarkMuted" variant="mono">
              {t(artwork.place)}
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
