import { EXPENSE_CATEGORIES, EXPENSE_CURRENCIES, type ExpenseCategory, type ExpenseCurrency } from '@citius/backend';
import { Button, PressableScale, space, Surface, Text, useAppTheme } from '@citius/ui';
import { Image } from 'expo-image';
import { router, usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { Chip, ChipRow, Icon, ProblemBanner, QuietState, Screen, TextField } from '@/components/kit';
import { parseAmount } from '@/features/expenses/format';
import { createOutboxItem } from '@/features/expenses/outbox';
import { useOutbox } from '@/features/expenses/outbox-context';
import { useReceipt } from '@/features/expenses/use-receipt';
import { localDay } from '@/features/headcount/headcount';
import { useCanReachServer } from '@/features/gate/reach';
import { useStaff } from '@/features/gate/session';
import { useTrips } from '@/features/trips/trips-context';
import { localId } from '@/lib/ids';
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
  const { selected, trips } = useTrips();
  const { enqueue } = useOutbox();
  const canSend = useCanReachServer();
  const toast = useToast();
  const [itemId] = useState(() => localId('exp'));
  // Starts on the trip shown on Today, as headcount does; the chips switch it to another trip.
  const [tripId, setTripId] = useState<string | null>(selected?.id ?? null);
  const trip = trips.find((candidate) => candidate.id === tripId) ?? null;
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<ExpenseCurrency>('INR');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [today] = useState(() => localDay(Date.now()));
  const [expenseDate, setExpenseDate] = useState(today);
  const [particulars, setParticulars] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  useAnnounce(problem);
  const { choosePhoto, discard, receipt, takePhoto } = useReceipt({ id: itemId, onProblem: setProblem });
  const [leaving, setLeaving] = useState(false);

  // Anything typed or photographed is lost on close, so closing asks first (swipe down or back).
  const entered = Boolean(receipt || amount.trim() || category || particulars.trim() || expenseDate !== today);
  const allowLeave = usePreventRemove(entered && !leaving, ({ repeat }) => {
    const lost = receipt ? 'What you entered and the receipt photo are removed from this phone.' : 'What you entered is not kept.';
    Alert.alert('Discard this expense?', lost, [
      { style: 'cancel', text: 'Keep editing' },
      {
        onPress: () => {
          discard();
          setLeaving(true);
          repeat();
        },
        style: 'destructive',
        text: 'Discard',
      },
    ]);
  });

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
    setLeaving(true);
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
    // Saved, so closing loses nothing: let this close through without the discard question.
    allowLeave();
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
        <ProblemBanner text={problem} />
      ) : null}
      <View style={{ gap: space.md }}>
        <Button busy={leaving} label="Save expense" onPress={save} />
        <Text style={{ textAlign: 'center' }} tone="muted" variant="secondary">
          Saved on this phone first. It is sent for approval as soon as you are online, and the photo is kept until it is.
        </Text>
      </View>
    </Screen>
  );
}
