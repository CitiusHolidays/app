import { EXPENSE_CATEGORIES, EXPENSE_CURRENCIES, type ExpenseCategory, type ExpenseCurrency } from '@citius/backend';
import { Banner, Button, PressableScale, space, Surface, Text, useAppTheme } from '@citius/ui';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { Chip, ChipRow, Icon, QuietState, Screen, TextField } from '@/components/kit';
import { parseAmount } from '@/features/expenses/format';
import { createOutboxItem, type ReceiptFile } from '@/features/expenses/outbox';
import { useOutbox } from '@/features/expenses/outbox-context';
import { keepReceipt } from '@/features/expenses/receipt-files';
import { localDay } from '@/features/headcount/headcount';
import { useStaff, useStaffSession } from '@/features/gate/session';
import { useTrips } from '@/features/trips/trips-context';
import { localId } from '@/lib/ids';
import { logEvent } from '@/lib/safe-log';
import { useAnnounce } from '@/lib/use-announce';
import { haptic } from '@/lib/haptics';
import { useToast } from '@/lib/toast';
import { EASE_OUT } from '@/lib/motion';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Receipt photo, amount and currency, saved to the outbox at once; it sends when online. */

const PHOTO_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.96 }] },
  100: { easing: EASE_OUT, opacity: 1, transform: [{ scale: 1 }] },
}).duration(240);
export default function NewExpense() {
  const theme = useAppTheme();
  const staff = useStaff();
  const { chosen, trips } = useTrips();
  const { enqueue } = useOutbox();
  const { gate, online } = useStaffSession();
  const canSend = online && gate.kind === 'staff' && !gate.offline;
  const toast = useToast();
  const [itemId] = useState(() => localId('exp'));
  // Only a trip the tour manager picked, never a default guess. It must be in their trip list.
  // The trip picked on Today, or the only trip assigned; with several and none picked, ask.
  const [tripId, setTripId] = useState<string | null>(chosen?.id ?? (trips.length === 1 ? (trips[0]?.id ?? null) : null));
  const trip = trips.find((candidate) => candidate.id === tripId) ?? null;
  const [receipt, setReceipt] = useState<ReceiptFile | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<ExpenseCurrency>('INR');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [expenseDate, setExpenseDate] = useState(() => localDay(Date.now()));
  const [particulars, setParticulars] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  useAnnounce(problem);
  const [busy, setBusy] = useState(false);

  const keep = async (result: ImagePicker.ImagePickerResult) => {
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    try {
      setReceipt(await keepReceipt(asset, itemId));
      setProblem(null);
    } catch (error) {
      logEvent('expense.receipt-copy-failed', error);
      setProblem('Could not save the photo on this phone. Try again.');
    }
  };

  useEffect(() => {
    // Android may stop the app while the camera is open; pick up the photo it took.
    ImagePicker.getPendingResultAsync()
      .then((pending) => {
        if (pending && 'assets' in pending) void keep(pending);
      })
      .catch(() => undefined);
    // Runs once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setProblem('Camera access is off. Allow it in Settings, or choose a photo from your library.');
      return;
    }
    await keep(await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 }));
  };

  const choosePhoto = async () => {
    await keep(await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 }));
  };

  const save = () => {
    const value = parseAmount(amount);
    const missing = [
      !receipt && 'a receipt photo',
      !value && 'an amount',
      !category && 'a category',
      !DATE_PATTERN.test(expenseDate) && 'a date as YYYY-MM-DD',
    ].filter(Boolean);
    if (!trip) {
      setProblem('Choose the trip this expense is for.');
      haptic('error');
      return;
    }
    if (missing.length || !receipt || !value || !category) {
      setProblem(`Add ${missing.join(', ')}.`);
      haptic('error');
      return;
    }
    setBusy(true);
    enqueue(
      createOutboxItem({
        draft: { amount: value, category, currency, expenseDate, paidBy: staff.name, particulars: particulars.trim() },
        id: itemId,
        jobCardId: trip.id,
        now: Date.now(),
        receipt,
        staffId: staff.staffId,
      })
    );
    haptic('success');
    toast(canSend ? 'Expense saved. Sending it for approval.' : 'Saved on this phone. It sends when you have signal.', canSend ? 'done' : 'saved');
    router.back();
  };

  const tile = {
    alignItems: 'center' as const,
    backgroundColor: theme.color.inset,
    borderColor: theme.color.controlBorder,
    borderRadius: theme.radius.inset,
    borderStyle: 'dashed' as const,
    borderWidth: 1.5,
    gap: space.sm,
    justifyContent: 'center' as const,
    padding: space.lg,
  };

  return (
    <Screen tabBar={false}>
      {trips.length > 0 ? (
        <ChipRow label="Trip" showLabel>
          {trips.map((candidate) => (
            <Chip
              key={candidate.id}
              label={`${candidate.jobCode} · ${candidate.clientName}`}
              onPress={() => setTripId(candidate.id)}
              selected={candidate.id === tripId}
            />
          ))}
        </ChipRow>
      ) : (
        <Surface>
          <QuietState text="No trips yet, so there is no trip to file an expense against." />
        </Surface>
      )}
      <View style={{ gap: space.sm }}>
        <Text accessibilityElementsHidden importantForAccessibility="no" variant="label">
          Receipt
        </Text>
        {receipt ? (
          // The photo settles in (scale 0.96 -> 1 and fade, 240 ms) where the camera button was.
          <Animated.View
            entering={PHOTO_IN}
            style={[tile, { borderStyle: 'solid', borderColor: theme.color.rule, borderWidth: StyleSheet.hairlineWidth, padding: space.sm }]}
          >
            <Image
              accessibilityLabel="Receipt photo"
              contentFit="contain"
              source={{ uri: receipt.uri }}
              style={{ aspectRatio: 3 / 4, borderRadius: theme.radius.control, maxHeight: 320, width: '100%' }}
            />
          </Animated.View>
        ) : (
          <PressableScale
            accessibilityHint="Opens the camera"
            accessibilityLabel="Take receipt photo"
            accessibilityRole="button"
            onPress={() => void takePhoto()}
            style={[tile, { minHeight: 168 }]}
          >
            <View
              style={{
                alignItems: 'center',
                backgroundColor: theme.color.card,
                borderColor: theme.color.border,
                borderRadius: 24,
                borderWidth: StyleSheet.hairlineWidth,
                height: 48,
                justifyContent: 'center',
                width: 48,
              }}
            >
              <Icon ios="camera" md="photo_camera" size={22} />
            </View>
            <Text variant="bodyStrong">Take receipt photo</Text>
            <Text tone="muted" variant="secondary">
              The whole receipt, flat and in focus
            </Text>
          </PressableScale>
        )}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {receipt ? (
            <View style={{ flex: 1 }}>
              <Button label="Retake" onPress={() => void takePhoto()} variant="secondary" />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button label={receipt ? 'Library' : 'Choose from library'} onPress={() => void choosePhoto()} variant="secondary" />
          </View>
        </View>
      </View>
      <TextField inputMode="decimal" keyboardType="decimal-pad" label="Amount" onChangeText={setAmount} placeholder="0.00" value={amount} />
      <ChipRow label="Currency" showLabel>
        {EXPENSE_CURRENCIES.map((code) => (
          <Chip key={code} label={code} onPress={() => setCurrency(code)} selected={currency === code} />
        ))}
      </ChipRow>
      <ChipRow label="Category" showLabel>
        {EXPENSE_CATEGORIES.map((head) => (
          <Chip key={head} label={head} onPress={() => setCategory(head)} selected={category === head} />
        ))}
      </ChipRow>
      <TextField autoCorrect={false} label="Date" onChangeText={setExpenseDate} placeholder="YYYY-MM-DD" value={expenseDate} />
      <TextField label="What it was for" onChangeText={setParticulars} placeholder="For example: Airport taxi for Bus 2" value={particulars} />
      {problem ? (
        <Banner tone="danger">
          <Text accessibilityLiveRegion="polite" variant="secondary">
            {problem}
          </Text>
        </Banner>
      ) : null}
      <View style={{ gap: space.md }}>
        <Button busy={busy} label="Save expense" onPress={save} />
        <Text style={{ textAlign: 'center' }} tone="muted" variant="secondary">
          Saved on this phone first. It is sent for approval as soon as you are online, and the photo is kept until it is.
        </Text>
      </View>
    </Screen>
  );
}
