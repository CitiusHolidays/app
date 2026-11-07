import type { ReceiptFile } from './outbox';

export interface PickedImage {
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string | null;
  uri: string;
}

/** Web preview: the picked blob URL is used as is; nothing is written to disk. */
export async function keepReceipt(image: PickedImage, id: string): Promise<ReceiptFile> {
  const mimeType = image.mimeType || 'image/jpeg';
  return { fileName: image.fileName || `receipt-${id}.jpg`, mimeType, size: image.fileSize ?? 0, uri: image.uri };
}

export function receiptExists() {
  return true;
}

export function deleteReceipt() {}

export function deleteAllReceipts() {}

export async function uploadReceipt(url: string, receipt: ReceiptFile) {
  const picked = await fetch(receipt.uri);
  if (!picked.ok) {
    // The picked photo is gone (the preview was reloaded): the same refusal as a missing file on a phone.
    throw Object.assign(new Error('Receipt file missing'), { data: 'Receipt file missing' });
  }
  const blob = await picked.blob();
  const response = await fetch(url, { body: blob, headers: { 'Content-Type': receipt.mimeType }, method: 'POST' });
  if (!response.ok) {
    throw new TypeError(`Upload failed with status ${response.status}`);
  }
  const { storageId } = (await response.json()) as { storageId?: string };
  if (!storageId) {
    throw new TypeError('Upload returned no storage id');
  }
  return storageId;
}
