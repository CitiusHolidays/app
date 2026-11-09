import { tripsListStatus, tripsProblemText } from './trips-list';

const base = { canReachServer: true, count: 0, fetch: { kind: 'idle' } as const, hasSavedList: false, read: true };

describe('what the phone can say about the trip list', () => {
  it('waits for the saved list before saying anything', () => {
    expect(tripsListStatus({ ...base, read: false }).kind).toBe('reading');
  });

  it('says it is loading, not that there are no trips, before the first answer', () => {
    expect(tripsListStatus(base).kind).toBe('loading');
    expect(tripsListStatus({ ...base, fetch: { kind: 'loading' } }).kind).toBe('loading');
  });

  it('says offline when nothing was ever saved and there is no connection', () => {
    expect(tripsListStatus({ ...base, canReachServer: false }).kind).toBe('offline');
  });

  it('says the download failed, and only an answer from the office means no trips', () => {
    expect(tripsListStatus({ ...base, fetch: { kind: 'failed' } }).kind).toBe('failed');
    expect(tripsListStatus({ ...base, fetch: { kind: 'loaded' }, hasSavedList: true }).kind).toBe('empty');
    expect(tripsListStatus({ ...base, canReachServer: false, hasSavedList: true }).kind).toBe('empty');
  });

  it('shows saved trips whatever the download is doing', () => {
    expect(tripsListStatus({ ...base, count: 2, fetch: { kind: 'failed' }, hasSavedList: true }).kind).toBe('ready');
  });

  it('words a failure for whether a saved list is shown', () => {
    expect(tripsProblemText({ kind: 'failed' }, true)).toBe('Could not refresh your trips. Showing the saved list.');
    expect(tripsProblemText({ kind: 'failed' }, false)).toBe('Could not load your trips. Pull down to try again.');
    expect(tripsProblemText({ kind: 'loaded' }, false)).toBeNull();
  });
});
