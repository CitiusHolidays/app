import { Banner, Button, space, Text } from '@citius/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, TextField } from '@/components/kit';
import { parseInviteToken } from '@/features/trips/model';
import { useI18n } from '@/i18n/i18n';

/** For an invite link that opened in a browser: paste it here instead. */
export default function InviteEntry() {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const submit = () => {
    const token = parseInviteToken(text);
    if (!token) {
      setInvalid(true);
      return;
    }
    router.replace({ params: { token }, pathname: '/invite' });
  };
  return (
    <Screen tabBar={false}>
      <View style={{ gap: space.lg, paddingTop: space.lg }}>
        <Text tone="muted">{t('invite.enterBody')}</Text>
        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          label={t('invite.enterLabel')}
          multiline
          onChangeText={(value) => {
            setText(value);
            setInvalid(false);
          }}
          value={text}
        />
        {invalid ? (
          <Banner tone="danger">
            <Text variant="secondary">{t('invite.enterInvalid')}</Text>
          </Banner>
        ) : null}
        <Button disabled={!text.trim()} label={t('invite.open')} onPress={submit} />
      </View>
    </Screen>
  );
}
