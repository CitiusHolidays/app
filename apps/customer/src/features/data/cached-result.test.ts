import { CACHE_SHAPE, cachedResult, type CacheInput, readCached } from './cached-result';

const saved = { savedAt: 100, shape: CACHE_SHAPE, value: 'saved' };
const base: CacheInput<string> = { asking: true, cached: null, held: undefined, live: undefined, loaded: true };

describe('cachedResult', () => {
  it('shows the live answer', () => {
    expect(cachedResult({ ...base, cached: saved, live: 'live' })).toEqual({ data: 'live', savedAt: 100, status: 'live' });
  });

  it('stays live with the last answer while new arguments wait for theirs', () => {
    expect(cachedResult({ ...base, cached: saved, held: 'before' })).toEqual({ data: 'before', savedAt: 100, status: 'live' });
  });

  it('drops the held answer once the query stops (offline)', () => {
    expect(cachedResult({ ...base, asking: false, cached: saved, held: 'before' }).status).toBe('saved');
  });

  it('shows what was saved while the server answers', () => {
    expect(cachedResult({ ...base, cached: saved })).toEqual({ data: 'saved', savedAt: 100, status: 'saved' });
  });

  it('loads while asking with nothing saved, or while the store is still being read', () => {
    expect(cachedResult(base).status).toBe('loading');
    expect(cachedResult({ ...base, asking: false, loaded: false }).status).toBe('loading');
  });

  it('is unavailable when not asking and nothing was saved, instead of loading forever', () => {
    expect(cachedResult({ ...base, asking: false })).toEqual({ data: undefined, savedAt: null, status: 'unavailable' });
  });
});

describe('readCached', () => {
  it('reads an answer saved in the current shape', () => {
    const stored = { savedAt: 100, shape: CACHE_SHAPE, value: 'saved' };
    expect(readCached(stored)).toBe(stored);
  });

  it('ignores answers saved by an older build or not saved at all', () => {
    expect(readCached({ savedAt: 100, value: 'saved' })).toBeNull();
    expect(readCached({ savedAt: 100, shape: CACHE_SHAPE - 1, value: 'saved' })).toBeNull();
    expect(readCached({ shape: CACHE_SHAPE, value: 'saved' })).toBeNull();
    expect(readCached(null)).toBeNull();
    expect(readCached('saved')).toBeNull();
  });
});
