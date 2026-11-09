import { LiveStore } from './live-store';
import { createMemoryStore } from './memory-store';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('LiveStore', () => {
  it('loads a key once, shares it with every subscriber and writes changes through', async () => {
    const store = createMemoryStore();
    await store.setJSON('k', { n: 1 });
    const live = new LiveStore(store);
    const seen: unknown[] = [];
    live.subscribe('k', () => seen.push(live.snapshot('k')?.value));
    expect(live.snapshot('k')).toBeUndefined();
    live.ensureLoaded('k');
    await flush();
    expect(live.snapshot('k')).toEqual({ value: { n: 1 } });
    live.set('k', { n: 2 });
    await flush();
    expect(await store.getJSON('k')).toEqual({ n: 2 });
    expect(seen).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('wipes the store and keeps every key loaded but empty', async () => {
    const store = createMemoryStore();
    const live = new LiveStore(store);
    await live.set('k', 'v');
    await live.wipe();
    expect(live.snapshot('k')).toEqual({ value: null });
    expect(await store.getJSON('k')).toBeNull();
  });

  it('resolves set only once the value is on disk', async () => {
    const store = createMemoryStore();
    const live = new LiveStore(store);
    await live.set('k', { n: 3 });
    expect(await store.getJSON('k')).toEqual({ n: 3 });
  });

  it('keeps the named keys through a wipe, loaded or not', async () => {
    const store = createMemoryStore();
    await store.setJSON('invite', 'tok');
    const live = new LiveStore(store);
    await live.set('language', 'hi');
    await live.set('trips', ['a']);
    await live.wipe(['language', 'invite', 'missing']);
    expect(live.snapshot('language')).toEqual({ value: 'hi' });
    expect(live.snapshot('invite')).toEqual({ value: 'tok' });
    expect(live.snapshot('trips')).toEqual({ value: null });
    expect(await store.getJSON('invite')).toBe('tok');
    expect(await store.getJSON('missing')).toBeNull();
  });

  it('does not let a read that started before a wipe bring old data back', async () => {
    const store = createMemoryStore();
    await store.setJSON('k', 'user A');
    const live = new LiveStore(store);
    live.ensureLoaded('k');
    await live.wipe();
    await flush();
    expect(live.snapshot('k')).toEqual({ value: null });
  });
});
