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

  it('keeps keys loaded but empty after a reset', async () => {
    const live = new LiveStore(createMemoryStore());
    live.set('k', 'v');
    live.reset();
    expect(live.snapshot('k')).toEqual({ value: null });
  });
});
