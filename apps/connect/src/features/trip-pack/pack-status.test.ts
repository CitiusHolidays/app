import { batches, commandCenter, tourManagers, travellers } from './fixtures';
import { packOf, packReducer, type PackStatus } from './pack-status';
import { buildTripPack } from './trip-pack';

const pack = buildTripPack({ batches, commandCenter, complete: true, savedAt: 1000, tourManagers, travellers });

describe('a trip pack on the phone', () => {
  it('starts loading, then shows the saved copy or says there is none', () => {
    expect(packReducer(undefined, { pack, type: 'read' })).toEqual({ kind: 'ready', pack });
    expect(packReducer(undefined, { pack: null, type: 'read' })).toEqual({ kind: 'none' });
  });

  it('keeps a saved copy on screen while it refreshes, and marks it stale when the refresh fails', () => {
    const ready: PackStatus = { kind: 'ready', pack };
    expect(packReducer(ready, { type: 'fetch' })).toBe(ready);
    const stale = packReducer(ready, { type: 'fetchFailed' });
    expect(stale).toEqual({ kind: 'stale', pack });
    expect(packOf(stale)).toBe(pack);
    // Reading the same copy again does not forget the failed refresh.
    expect(packReducer(stale, { pack, type: 'read' })).toBe(stale);
    expect(packReducer(stale, { pack, type: 'fetched' })).toEqual({ kind: 'ready', pack });
  });

  it('tells a failed first download apart from a pack that was never fetched', () => {
    const fetching = packReducer({ kind: 'none' }, { type: 'fetch' });
    expect(fetching).toEqual({ kind: 'fetching' });
    // A re-read finding nothing does not hide the download under way.
    expect(packReducer(fetching, { pack: null, type: 'read' })).toBe(fetching);
    expect(packReducer(fetching, { type: 'fetchFailed' })).toEqual({ kind: 'failed' });
    expect(packOf({ kind: 'failed' })).toBeNull();
  });

  it('remembers that the office stopped the app for the trip', () => {
    const off = packReducer({ kind: 'ready', pack }, { type: 'off' });
    expect(off).toEqual({ kind: 'off' });
    expect(packReducer(off, { pack: null, type: 'read' })).toBe(off);
  });
});
