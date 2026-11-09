export type ScanState =
  | { kind: 'loading' }
  // `quality`: a small preview on screen while the full scan loads ('preview'), the full scan
  // ('full'), or the preview kept because the full scan failed ('previewOnly').
  | { aspect?: number; kind: 'image'; previewUri?: string; quality: 'full' | 'preview' | 'previewOnly'; uri: string }
  | { kind: 'pdf'; uri: string }
  | { kind: 'other' | 'pdfUnsupported' }
  | { kind: 'hidden' }
  | { kind: 'problem'; problem: string };

/**
 * One viewer of a scan. Every open is numbered; each server read belongs to one open, and an
 * answer for any other open is dropped.
 *
 * - `waiting`: the open has not read yet (offline, or no traveller). It reads once it can.
 * - `reading`: the read is in flight. On screen: the skeleton, or the preview while the full scan
 *   loads.
 * - `shown`: the open is over and its outcome is on screen: the scan, or why it is not there.
 * - `hidden`: the app left the foreground, which ends the open. Only `again` reads it afresh.
 *
 * One read per open: losing and regaining the connection does not read it again, and a read
 * already in flight carries on.
 */
export type ScanMachine =
  | { open: number; phase: 'waiting' }
  | { open: number; phase: 'reading'; view: ScanState }
  | { open: number; phase: 'shown'; view: ScanState }
  | { open: number; phase: 'hidden' };

export type ScanEvent =
  /** The open's read is sent. */
  | { open: number; type: 'start' }
  /** What the open's read has so far: a preview while the full scan loads, or its final outcome. */
  | { final: boolean; open: number; type: 'show'; view: ScanState }
  /** The app left the foreground (or the app switcher took a snapshot). */
  | { type: 'left' }
  /** The person asks for the scan again: a new open, and a new audited read. */
  | { type: 'again' }
  /** The native PDF view could not open the file that is on screen. */
  | { problem: string; type: 'pdfFailed' };

export const initialScan: ScanMachine = { open: 0, phase: 'waiting' };

export function scanReducer(state: ScanMachine, event: ScanEvent): ScanMachine {
  switch (event.type) {
    case 'start':
      return state.phase === 'waiting' && state.open === event.open ? { open: state.open, phase: 'reading', view: { kind: 'loading' } } : state;
    case 'show':
      if (state.phase !== 'reading' || state.open !== event.open) return state;
      return { open: state.open, phase: event.final ? 'shown' : 'reading', view: event.view };
    case 'left':
      // Nothing is on screen before the read starts, so there is nothing to hide.
      return state.phase === 'waiting' ? state : { open: state.open, phase: 'hidden' };
    case 'again':
      return { open: state.open + 1, phase: 'waiting' };
    case 'pdfFailed':
      return state.phase === 'shown' && state.view.kind === 'pdf'
        ? { open: state.open, phase: 'shown', view: { kind: 'problem', problem: event.problem } }
        : state;
  }
}

/** What the screen shows for the machine's state. */
export function scanView(state: ScanMachine): ScanState {
  switch (state.phase) {
    case 'waiting':
      return { kind: 'loading' };
    case 'hidden':
      return { kind: 'hidden' };
    default:
      return state.view;
  }
}
