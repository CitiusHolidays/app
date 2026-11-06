import { Directory, File, Paths } from 'expo-file-system';

import type { ReceiptFile } from './outbox';

/**
 * Receipts wait in the app's cache folder until their expense is submitted. Unlike documents,
 * the cache is left out of iCloud and Android Auto Backup, so receipt photos never leave the
 * phone in a backup. The OS may clear the cache when storage runs very low; the outbox then
 * asks the tour manager to add the expense again (see "Receipt file missing").
 */
function receiptsDirectory() {
  return new Directory(Paths.cache, 'receipts');
}

/** Where earlier builds kept receipts (backed up); emptied on sign-out. */
function legacyReceiptsDirectory() {
  return new Directory(Paths.document, 'receipts');
}

export interface PickedImage {
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string | null;
  uri: string;
}

function extensionFor(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return 'heic';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Copies a picked photo out of the picker's temporary cache before anything else happens, so the
 * receipt survives the picker cleaning up, the app restarting or a failed upload.
 */
export async function keepReceipt(image: PickedImage, id: string): Promise<ReceiptFile> {
  const directory = receiptsDirectory();
  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }
  const mimeType = image.mimeType || 'image/jpeg';
  const extension = extensionFor(mimeType);
  const destination = new File(directory, `${id}.${extension}`);
  await new File(image.uri).copy(destination, { overwrite: true });
  return { fileName: `receipt-${id}.${extension}`, mimeType, size: destination.size, uri: destination.uri };
}

export function receiptExists(receipt: ReceiptFile) {
  return new File(receipt.uri).exists;
}

export function deleteReceipt(receipt: ReceiptFile) {
  const file = new File(receipt.uri);
  if (file.exists) {
    file.delete();
  }
}

export function deleteAllReceipts() {
  for (const directory of [receiptsDirectory(), legacyReceiptsDirectory()]) {
    if (directory.exists) {
      directory.delete();
    }
  }
}

/** Uploads the receipt bytes to a Convex upload URL and returns the storage id. */
export async function uploadReceipt(url: string, receipt: ReceiptFile) {
  const file = new File(receipt.uri);
  if (!file.exists) {
    throw Object.assign(new Error('Receipt file missing'), { data: 'Receipt file missing' });
  }
  const result = await file.upload(url, { headers: { 'Content-Type': receipt.mimeType }, httpMethod: 'POST' });
  if (result.status < 200 || result.status >= 300) {
    throw new TypeError(`Upload failed with status ${result.status}`);
  }
  const { storageId } = JSON.parse(result.body) as { storageId?: string };
  if (!storageId) {
    throw new TypeError('Upload returned no storage id');
  }
  return storageId;
}
