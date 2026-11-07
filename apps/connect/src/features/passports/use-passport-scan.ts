import { type FieldPassportFile, staffApi } from '@citius/backend';
import { useConvex } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { logEvent } from '@/lib/safe-log';

import { deleteAllPassportPdfs, deletePassportPdf, writePassportPdf } from './passport-pdf-file';
import { base64FromBytes, passportProblem, passportViewKind } from './passport-window';
import { canShowPdf } from './pdf-support';

export type ScanState =
  | { kind: 'loading' }
  // `quality`: a small preview on screen while the full scan loads ('preview'), the full scan
  // ('full'), or the preview kept because the full scan failed ('previewOnly').
  | { aspect?: number; kind: 'image'; previewUri?: string; quality: 'full' | 'preview' | 'previewOnly'; uri: string }
  | { kind: 'pdf'; uri: string }
  | { kind: 'other' | 'pdfUnsupported' }
  | { kind: 'hidden' }
  | { kind: 'problem'; problem: string };

const dataUri = (mimeType: string, bytes: ArrayBuffer) => `data:${mimeType};base64,${base64FromBytes(bytes)}`;

/**
 * One open of a scan. On 3G a full scan takes many seconds: an image shows a ~60 KB preview
 * first, then the full scan. A PDF (or a file the server cannot preview) is read in full.
 * Nothing is shown once the open is over (`isActive`) or while the app is in the background.
 */
async function openScan(open: {
  isActive: () => boolean;
  isForeground: () => boolean;
  read: (variant: 'full' | 'preview') => Promise<FieldPassportFile>;
  show: (view: ScanState) => void;
}) {
  /** False when the open is over; hides the scan if the app went to the background meanwhile. */
  const stillShowing = () => {
    if (!open.isActive()) return false;
    if (open.isForeground()) return true;
    open.show({ kind: 'hidden' });
    return false;
  };

  const first = await open.read('preview');
  if (!stillShowing()) return;
  if ('variant' in first && first.variant === 'preview') {
    const previewUri = dataUri(first.mimeType, first.bytes);
    const aspect = first.width > 0 && first.height > 0 ? first.width / first.height : undefined;
    open.show({ aspect, kind: 'image', quality: 'preview', uri: previewUri });
    try {
      const full = await open.read('full');
      if (!stillShowing()) return;
      if (!('bytes' in full)) throw new Error('Full scan missing');
      open.show({ aspect, kind: 'image', previewUri, quality: 'full', uri: dataUri(full.mimeType, full.bytes) });
    } catch (error) {
      logEvent('passport.full-failed', error);
      if (open.isActive() && open.isForeground()) open.show({ aspect, kind: 'image', quality: 'previewOnly', uri: previewUri });
    }
    return;
  }
  const file = 'bytes' in first ? first : await open.read('full');
  if (!stillShowing()) return;
  if (!('bytes' in file)) throw new Error('Passport file missing');
  const kind = passportViewKind(file.mimeType);
  if (kind === 'image') {
    open.show({ kind, quality: 'full', uri: dataUri(file.mimeType, file.bytes) });
  } else if (kind === 'pdf') {
    open.show(canShowPdf() ? { kind, uri: writePassportPdf(file.bytes) } : { kind: 'pdfUnsupported' });
  } else {
    open.show({ kind });
  }
}

/**
 * A traveller's passport scan for the viewer: read from the server once per open, held only in
 * memory (a PDF in one private file that lives exactly as long as it is on screen), and dropped
 * when the app leaves the foreground. `again` opens it afresh.
 */
export function usePassportScan(travellerId: string | undefined, canReachServer: boolean) {
  const convex = useConvex();
  const [view, setView] = useState<ScanState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const fetched = useRef<number | null>(null);
  // False while the app is in the background: a read that lands then is not shown or written.
  const foreground = useRef(true);

  useEffect(() => {
    // One read per open: losing and regaining the connection does not read it again.
    if (!(canReachServer && travellerId) || fetched.current === attempt) {
      return;
    }
    fetched.current = attempt;
    let active = true;
    // Both reads of this open share one audit row and one rate-limit count on the server.
    const openId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    openScan({
      isActive: () => active,
      isForeground: () => foreground.current,
      read: (variant) => convex.action(staffApi.getFieldPassportFile.ref, { openId, travellerId, variant }),
      show: setView,
    }).catch((error: unknown) => {
      logEvent('passport.open-failed', error);
      if (active) setView({ kind: 'problem', problem: passportProblem(error) });
    });
    return () => {
      active = false;
    };
  }, [attempt, canReachServer, convex, travellerId]);

  // The PDF's file lives exactly as long as it is on screen: any change of view, or closing the
  // screen, deletes it.
  const pdfUri = view.kind === 'pdf' ? view.uri : null;
  useEffect(() => {
    if (!pdfUri) return;
    return () => deletePassportPdf(pdfUri);
  }, [pdfUri]);

  useEffect(() => {
    // Leaving the app (or the app switcher, which snapshots the screen) drops the scan. The file
    // goes at once, without waiting for a render the OS may not allow in the background.
    const subscription = AppState.addEventListener('change', (state) => {
      foreground.current = state === 'active';
      if (state !== 'active') {
        deleteAllPassportPdfs();
        setView({ kind: 'hidden' });
      }
    });
    return () => subscription.remove();
  }, []);

  const again = () => {
    foreground.current = true;
    setView({ kind: 'loading' });
    setAttempt((value) => value + 1);
  };

  return { again, setView, view };
}
