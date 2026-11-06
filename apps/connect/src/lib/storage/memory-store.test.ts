import { createMemoryStore } from './memory-store';

describe('memory key-value store', () => {
  it('stores, lists by prefix and deletes JSON values', async () => {
    const store = createMemoryStore();
    await store.setJSON('pack:jc1', { a: 1 });
    await store.setJSON('pack:jc2', { a: 2 });
    await store.setJSON('headcount:jc1', { b: 1 });
    expect(await store.getJSON('pack:jc1')).toEqual({ a: 1 });
    expect((await store.keys('pack:')).sort()).toEqual(['pack:jc1', 'pack:jc2']);
    await store.delete('pack:jc1');
    expect(await store.getJSON('pack:jc1')).toBeNull();
    await store.clear();
    expect(await store.keys('')).toEqual([]);
  });
});
