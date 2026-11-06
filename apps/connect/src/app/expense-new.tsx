import { EXPENSE_CATEGORIES, EXPENSE_CURRENCIES, type ExpenseCategory, type ExpenseCurrency } from '@citius/backend';
import { Button, space, Text } from '@citius/ui';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Chip, ChipRow, haptic, Screen, TextField } from '@/components/kit';
import { parseAmount } from '@/features/expenses/format';
import { createOutboxItem, type ReceiptFile } from '@/features/expenses/outbox';
import { useOutbox } from '@/features/expenses/outbox-context';
import { keepReceipt } from '@/features/expenses/receipt-files';
import { localDay } from '@/features/headcount/headcount';
import { useStaff } from '@/features/gate/session';
import { useTrips } from '@/features/trips/trips-context';
import { localId } from '@/lib/ids';
import { logEvent } from '@/lib/safe-log';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Receipt photo, amount and currency, saved to the outbox at once; it sends when online. */
export default function NewExpense() {
  const staff = useStaff();
  const { selected } = useTrips();
  const { enqueue } = useOutbox();
  const [itemId] = useState(() => localId('exp'));
  const [receipt, setReceipt] = useState<ReceiptFile | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<ExpenseCurrency>('INR');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [expenseDate, setExpenseDate] = useState(() => localDay(Date.now()));
  const [particulars, setParticulars] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
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
    await keep(await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.7 }));
  };

  const choosePhoto = async () => {
    await keep(await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7 }));
  };

  const save = () => {
    const value = parseAmount(amount);
    const missing = [
      !receipt && 'a receipt photo',
      !value && 'an amount',
      !category && 'a category',
      !DATE_PATTERN.test(expenseDate) && 'a date as YYYY-MM-DD',
    ].filter(Boolean);
    if (!selected) {
      setProblem('Choose a trip on Today first.');
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
        jobCardId: selected.id,
        now: Date.now(),
        receipt,
      })
    );
    haptic('success');
    router.back();
  };

  return (
    <Screen>
      <Text variant="secondary" tone="muted">
        {selected ? `For ${selected.jobCode} · ${selected.clientName}` : 'Choose a trip on Today first.'}
      </Text>
      {receipt ? (
        <Image
          accessibilityLabel="Receipt photo"
          contentFit="contain"
          source={{ uri: receipt.uri }}
          style={{ aspectRatio: 3 / 4, borderRadius: 12, maxHeight: 320, width: '100%' }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <View style={{ flexGrow: 1 }}>
          <Button label={receipt ? 'Retake photo' : 'Take receipt photo'} onPress={() => void takePhoto()} />
        </View>
        <View style={{ flexGrow: 1 }}>
          <Button label="Choose from library" onPress={() => void choosePhoto()} variant="secondary" />
        </View>
      </View>
      <TextField inputMode="decimal" keyboardType="decimal-pad" label="Amount" onChangeText={setAmount} placeholder="0.00" value={amount} />
      <ChipRow label="Currency">
        {EXPENSE_CURRENCIES.map((code) => (
          <Chip key={code} label={code} onPress={() => setCurrency(code)} selected={currency === code} />
        ))}
      </ChipRow>
      <ChipRow label="Category">
        {EXPENSE_CATEGORIES.map((head) => (
          <Chip key={head} label={head} onPress={() => setCategory(head)} selected={category === head} />
        ))}
      </ChipRow>
      <TextField autoCorrect={false} label="Date" onChangeText={setExpenseDate} placeholder="YYYY-MM-DD" value={expenseDate} />
      <TextField label="What it was for" onChangeText={setParticulars} placeholder="For example: Airport taxi for Bus 2" value={particulars} />
      {problem ? (
        <Text accessibilityLiveRegion="polite" tone="warning">
          {problem}
        </Text>
      ) : null}
      <Button busy={busy} label="Save expense" onPress={save} />
      <Text variant="secondary" tone="muted">
        Saved on this phone first. It is sent for approval as soon as you are online, and the photo is kept until it is.
      </Text>
    </Screen>
  );
}
