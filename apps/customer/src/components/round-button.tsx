import { PressableScale, useAppTheme } from '@citius/ui';

import { Icon } from '@/components/kit';
import { useI18n } from '@/i18n/i18n';
import { closeScreen } from '@/lib/navigation';

/**
 * The round Back (or Close) button for screens without a header: glass over a photo, card on the
 * cream ground. It leaves the screen, or goes to Journeys after a cold start from a link.
 */
export function RoundBackButton({ close, onPaper }: { close?: boolean; onPaper?: boolean }) {
  const theme = useAppTheme();
  const { t } = useI18n();
  return (
    <PressableScale
      accessibilityLabel={t(close ? 'common.close' : 'common.back')}
      accessibilityRole="button"
      hitSlop={8}
      onPress={closeScreen}
      style={{
        alignItems: 'center',
        backgroundColor: onPaper ? theme.color.card : 'rgba(11,16,38,0.45)',
        borderColor: onPaper ? theme.color.border : 'rgba(255,255,255,0.35)',
        borderRadius: 24,
        borderWidth: 1,
        height: 48,
        justifyContent: 'center',
        width: 48,
      }}
    >
      {close ? (
        <Icon color={onPaper ? theme.color.ink : '#ffffff'} ios="xmark" md="close" size={18} />
      ) : (
        <Icon color={onPaper ? theme.color.ink : '#ffffff'} ios="chevron.left" md="arrow_back" size={18} />
      )}
    </PressableScale>
  );
}
