import { type FieldPassportFile, staffApi } from '@citius/backend';
import { useConvex } from 'convex/react';
import { useEffect, useReducer } from 'react';
import { AppState } from 'react-native';

import { logEvent } from '@/lib/safe-log';

import { deleteAllPassportPdfs, deletePassportPdf, writePassportPdf } from './passport-pdf-file';
import { base64FromBytes, passportProblem, passportViewKind } from './passport-window';
import { canShowPdf } from './pdf-support';
import { initialScan, scanReducer, type ScanState, scanView } from './scan-machine';

export type { ScanState } from './scan-machine';

const dataUri = (mimeType: string, bytes: ArrayBuffer) => `data:${mimeType};base64,${base64FromBytes(bytes)}`;

/**
 * One open of a scan. On 3G a full scan takes many seconds: an image shows a ~60 KB preview
 * first, then the full scan. A PDF (or a file the server cannot preview) is read in full.
 * Nothing more is read, written or shown once the open is over (`isCurrent`), which includes
 * the app leaving the foreground.
 */
async function openScan(open: {
  isCurrent: () => boolean;
  read: (variant: 'full' | 'preview') => Promise<FieldPassportFile>;
  show: (view: ScanState, final: boolean) => void;
}) {
  const first = await open.read('preview');
  if (!open.isCurrent()) return;
  if ('variant' in first && first.variant === 'preview') {
    const previewUri = dataUri(first.mimeType, first.bytes);
    const aspect = first.width > 0 && first.height > 0 ? first.width / first.height : undefined;
    open.show({ aspect, kind: 'image', quality: 'preview', uri: previewUri }, false);
    try {
      const full = await open.read('full');
      if (!open.isCurrent()) return;
      if (!('bytes' in full)) throw new Error('Full scan missing');
      open.show({ aspect, kind: 'image', previewUri, quality: 'full', uri: dataUri(full.mimeType, full.bytes) }, true);
    } catch (error) {
      logEvent('passport.full-failed', error);
      if (open.isCurrent()) open.show({ aspect, kind: 'image', quality: 'previewOnly', uri: previewUri }, true);
    }
    return;
  }
  const file = 'bytes' in first ? first : await open.read('full');
  if (!open.isCurrent()) return;
  if (!('bytes' in file)) throw new Error('Passport file missing');
  const kind = passportViewKind(file.mimeType);
  if (kind === 'image') {
    open.show({ kind, quality: 'full', uri: dataUri(file.mimeType, file.bytes) }, true);
  } else if (kind === 'pdf') {
    open.show(canShowPdf() ? { kind, uri: writePassportPdf(file.bytes) } : { kind: 'pdfUnsupported' }, true);
  } else {
    open.show({ kind }, true);
  }
}

/**
 * A traveller's passport scan for the viewer: read from the server once per open, held only in
 * memory (a PDF in one private file that lives exactly as long as it is on screen), and dropped
 * when the app leaves the foreground. `again` opens it afresh.
 */
export function usePassportScan(travellerId: string | undefined, canReachServer: boolean) {
  const convex = useConvex();
  const [scan, dispatch] = useReducer(scanReducer, initialScan);
  // The open to read now, if any. It stays the same from `waiting` through `reading`, so the read
  // is not cut short by the start itself or by the connection dropping; it ends when the open does.
  const readOpen = scan.phase === 'reading' || (scan.phase === 'waiting' && canReachServer) ? scan.open : null;

  useEffect(() => {
    if (readOpen === null || !travellerId) return;
    const open = readOpen;
    dispatch({ open, type: 'start' });
    let active = true;
    // Both reads of this open share one audit row and one rate-limit count on the server.
    const openId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    openScan({
      // AppState rather than the reducer: the app may go to the background before React renders
      // again, and nothing may be read or written for the screen from then on.
      isCurrent: () => active && AppState.currentState === 'active',
      read: (variant) => convex.action(staffApi.getFieldPassportFile.ref, { openId, travellerId, variant }),
      show: (view, final) => dispatch({ final, open, type: 'show', view }),
    }).catch((error: unknown) => {
      logEvent('passport.open-failed', error);
      if (active) dispatch({ final: true, open, type: 'show', view: { kind: 'problem', problem: passportProblem(error) } });
    });
    return () => {
      active = false;
    };
  }, [convex, readOpen, travellerId]);

  const view = scanView(scan);
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
      if (state !== 'active') {
        deleteAllPassportPdfs();
        dispatch({ type: 'left' });
      }
    });
    return () => subscription.remove();
  }, []);

  return {
    again: () => dispatch({ type: 'again' }),
    pdfFailed: (problem: string) => dispatch({ problem, type: 'pdfFailed' }),
    view,
  };
}
