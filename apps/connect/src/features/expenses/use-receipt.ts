import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';

import { logEvent } from '@/lib/safe-log';

import type { ReceiptFile } from './outbox';
import { deleteReceipt, keepReceipt } from './receipt-files';

/**
 * The receipt photo for one new expense: taken or picked, then copied into the app's receipts
 * folder at once. A photo replaced by a retake, or left behind when the form is discarded, is
 * deleted; one that is saved with the expense stays until the expense is sent.
 */
export function useReceipt({ id, onProblem }: { id: string; onProblem: (problem: string | null) => void }) {
  const [receipt, setReceipt] = useState<ReceiptFile | null>(null);

  const keep = async (result: ImagePicker.ImagePickerResult) => {
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    try {
      const kept = await keepReceipt(asset, id);
      // A retake in another format lands under a new name; the old file would be orphaned.
      if (receipt && receipt.uri !== kept.uri) deleteReceipt(receipt);
      setReceipt(kept);
      onProblem(null);
    } catch (error) {
      logEvent('expense.receipt-copy-failed', error);
      onProblem('Could not save the photo on this phone. Try again.');
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
      onProblem('Camera access is off. Allow it in Settings, or choose a photo from your library.');
      return;
    }
    await keep(await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 }));
  };

  const choosePhoto = async () => {
    await keep(await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 }));
  };

  /** The form is being abandoned: the copied photo has no expense to wait for. */
  const discard = () => {
    if (receipt) deleteReceipt(receipt);
  };

  return { choosePhoto, discard, receipt, takePhoto };
}
