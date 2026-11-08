import { PressableScale, space, Text, useAppTheme } from '@citius/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, ListCard, Screen } from '@/components/kit';
import { Pop } from '@/components/motion-views';
import { useI18n } from '@/i18n/i18n';
import { LANGUAGES } from '@/i18n/languages';
import { haptic } from '@/lib/haptic';

/** Long enough to see the tick land on the new language before the screen closes. */
const CLOSE_AFTER_MS = 320;

/** Every language Citius is building for; the ones not translated yet are listed but not offered. */
export default function LanguageScreen() {
  const theme = useAppTheme();
  const { language, setLanguage, t } = useI18n();
  // The tick only pops when it moves to a new language, not on every visit.
  const [opened] = useState(language.code);
  return (
    <Screen contentInsetAdjustmentBehavior="automatic" tabBar={false}>
      <Text tone="muted">{t('language.body')}</Text>
      <ListCard>
        {LANGUAGES.map((option, index) => {
          const selected = option.code === language.code;
          const ready = option.status === 'complete';
          return (
            <PressableScale
              accessibilityLabel={`${option.nativeName}, ${option.englishName}${ready ? '' : `, ${t('language.planned')}`}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: !ready }}
              disabled={!ready}
              key={option.code}
              onPress={() => {
                if (selected) {
                  router.back();
                  return;
                }
                haptic('selection');
                void setLanguage(option.code).then(() => setTimeout(() => router.back(), CLOSE_AFTER_MS));
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  borderBottomColor: theme.color.rule,
                  borderBottomWidth: index === LANGUAGES.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  flexDirection: 'row',
                  gap: space.md,
                  minHeight: 60,
                  paddingVertical: space.sm,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="rowTitle">{option.nativeName}</Text>
                  <Text tone="muted" variant="label">
                    {ready ? option.englishName : `${option.englishName} · ${t('language.planned')}`}
                  </Text>
                </View>
                {selected && option.code !== opened ? (
                  <Pop>
                    <Icon color={theme.color.primary} ios="checkmark.circle.fill" md="check_circle" size={22} />
                  </Pop>
                ) : null}
                {selected && option.code === opened ? <Icon color={theme.color.primary} ios="checkmark.circle.fill" md="check_circle" size={22} /> : null}
              </View>
            </PressableScale>
          );
        })}
      </ListCard>
    </Screen>
  );
}
