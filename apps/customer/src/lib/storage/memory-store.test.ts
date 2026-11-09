import { createMemoryStore } from './memory-store';

describe('memory key-value store', () => {
  it('stores, reads and clears JSON values', async () => {
    const store = createMemoryStore();
    await store.setJSON('trips:list', { a: 1 });
    expect(await store.getJSON('trips:list')).toEqual({ a: 1 });
    expect(await store.getJSON('missing')).toBeNull();
    await store.clear();
    expect(await store.getJSON('trips:list')).toBeNull();
  });
});
