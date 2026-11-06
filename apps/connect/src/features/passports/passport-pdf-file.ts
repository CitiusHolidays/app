import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { logEvent } from '@/lib/safe-log';

/**
 * The native PDF view reads from a file, so an open PDF passport is the one thing the app ever
 * writes for a passport: a randomly named file in the app's private cache folder (inside the app
 * sandbox, and left out of iCloud and Android Auto Backup). It exists only while the viewer shows
 * it: the viewer deletes it when it closes or the app leaves the foreground, and the whole folder
 * is emptied at start-up (after a crash, say) and on sign-out.
 */
function viewDirectory() {
  return new Directory(Paths.cache, 'passport-view');
}

/** Writes the decrypted bytes to a new private file and returns its `file://` URI. */
export function writePassportPdf(bytes: ArrayBuffer) {
  const directory = viewDirectory();
  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }
  const file = new File(directory, `${randomUUID()}.pdf`);
  file.create();
  file.writeSync(new Uint8Array(bytes));
  return file.uri;
}

export function deletePassportPdf(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (error) {
    logEvent('passport.pdf-delete-failed', error);
  }
}

/** Deletes every passport view file there is. Safe to call at any time. */
export function deleteAllPassportPdfs() {
  try {
    const directory = viewDirectory();
    if (directory.exists) directory.delete();
  } catch (error) {
    logEvent('passport.pdf-delete-failed', error);
  }
}
