import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

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
  height?: number;
  mimeType?: string | null;
  uri: string;
  width?: number;
}

/**
 * Small print on a receipt (GST numbers, totals) stays sharp at 2048 px on the long edge and JPEG
 * quality 0.8, typically 400–700 KB; a 12 MP photo is several MB of wasted bytes on 3G. This is
 * the only lossy step: the camera and library hand over the photo at full quality.
 */
const RECEIPT_LONG_EDGE = 2048;
const RECEIPT_QUALITY = 0.8;

/** The resize for a photo, or null when it is already small enough or its size is unknown. */
export function receiptSize(width: number | undefined, height: number | undefined) {
  if (!width || !height || Math.max(width, height) <= RECEIPT_LONG_EDGE) {
    return null;
  }
  return width >= height ? { height: null, width: RECEIPT_LONG_EDGE } : { height: RECEIPT_LONG_EDGE, width: null };
}

/** A smaller JPEG of the photo, or null when it cannot be decoded (the original is kept then). */
async function shrink(image: PickedImage) {
  try {
    const context = ImageManipulator.manipulate(image.uri);
    const size = receiptSize(image.width, image.height);
    if (size) context.resize(size);
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ compress: RECEIPT_QUALITY, format: SaveFormat.JPEG });
    return result.uri;
  } catch {
    return null;
  }
}

function extensionFor(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return 'heic';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Shrinks a picked photo to a receipt-sized JPEG and copies it out of the picker's temporary cache
 * before anything else happens, so the receipt survives the picker cleaning up, the app restarting
 * or a failed upload, and costs a few hundred KB to send instead of several MB.
 */
export async function keepReceipt(image: PickedImage, id: string): Promise<ReceiptFile> {
  const directory = receiptsDirectory();
  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }
  const smaller = await shrink(image);
  const mimeType = smaller ? 'image/jpeg' : image.mimeType || 'image/jpeg';
  const extension = extensionFor(mimeType);
  const destination = new File(directory, `${id}.${extension}`);
  await new File(smaller ?? image.uri).copy(destination, { overwrite: true });
  if (smaller) {
    try {
      new File(smaller).delete();
    } catch {
      // The manipulator's temporary file is cleared with the cache anyway.
    }
  }
  return { fileName: `receipt-${id}.${extension}`, mimeType, size: destination.size, uri: destination.uri };
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

/** The storage id in a Convex upload answer, or null when the answer is not the expected JSON. */
function storageIdFrom(body: string) {
  let answer: unknown;
  try {
    answer = JSON.parse(body);
  } catch {
    return null;
  }
  const storageId = typeof answer === 'object' && answer !== null ? (answer as { storageId?: unknown }).storageId : undefined;
  return typeof storageId === 'string' && storageId ? storageId : null;
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
  const storageId = storageIdFrom(result.body);
  if (!storageId) {
    throw new TypeError('Upload returned no storage id');
  }
  return storageId;
}
