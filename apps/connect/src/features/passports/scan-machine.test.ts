import { initialScan, type ScanEvent, type ScanMachine, scanReducer, scanView } from './scan-machine';

const run = (events: ScanEvent[], from: ScanMachine = initialScan) => events.reduce(scanReducer, from);
const preview = { kind: 'image', quality: 'preview', uri: 'data:preview' } as const;
const full = { kind: 'image', quality: 'full', uri: 'data:full' } as const;

describe('passport scan machine', () => {
  it('waits, reads, shows the preview, then the full scan', () => {
    expect(scanView(initialScan)).toEqual({ kind: 'loading' });
    const reading = run([{ open: 0, type: 'start' }]);
    expect(reading).toEqual({ open: 0, phase: 'reading', view: { kind: 'loading' } });
    const previewing = run([{ final: false, open: 0, type: 'show', view: preview }], reading);
    expect(previewing).toEqual({ open: 0, phase: 'reading', view: preview });
    expect(run([{ final: true, open: 0, type: 'show', view: full }], previewing)).toEqual({ open: 0, phase: 'shown', view: full });
  });

  it('starts an open only once', () => {
    const shown = run([{ open: 0, type: 'start' }, { final: true, open: 0, type: 'show', view: full }]);
    expect(run([{ open: 0, type: 'start' }], shown)).toBe(shown);
  });

  it('ends the open when the app leaves, and drops what that open reads later', () => {
    const hidden = run([{ open: 0, type: 'start' }, { type: 'left' }]);
    expect(scanView(hidden)).toEqual({ kind: 'hidden' });
    expect(run([{ final: true, open: 0, type: 'show', view: full }], hidden)).toBe(hidden);
  });

  it('has nothing to hide before the read starts', () => {
    expect(run([{ type: 'left' }])).toBe(initialScan);
  });

  it('opens afresh on again, and ignores the earlier open', () => {
    const again = run([{ open: 0, type: 'start' }, { type: 'again' }]);
    expect(again).toEqual({ open: 1, phase: 'waiting' });
    expect(run([{ final: true, open: 0, type: 'show', view: full }], again)).toBe(again);
    expect(run([{ open: 1, type: 'start' }, { final: true, open: 1, type: 'show', view: full }], again)).toEqual({
      open: 1,
      phase: 'shown',
      view: full,
    });
  });

  it('turns a PDF the native view cannot open into a problem, and nothing else', () => {
    const pdf = run([{ open: 0, type: 'start' }, { final: true, open: 0, type: 'show', view: { kind: 'pdf', uri: 'file:///a.pdf' } }]);
    expect(scanView(run([{ problem: 'Cannot open', type: 'pdfFailed' }], pdf))).toEqual({ kind: 'problem', problem: 'Cannot open' });
    const image = run([{ open: 0, type: 'start' }, { final: true, open: 0, type: 'show', view: full }]);
    expect(run([{ problem: 'Cannot open', type: 'pdfFailed' }], image)).toBe(image);
  });
});
