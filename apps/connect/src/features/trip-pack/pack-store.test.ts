import { createMemoryStore } from '@/lib/storage/memory-store';

import { batches, commandCenter, tourManagers, travellers } from './fixtures';
import { loadPack, purgeExpiredPacks, savePack } from './pack-store';
import { buildTripPack } from './trip-pack';

const SAVED_AT = new Date(2026, 10, 6, 7, 12).getTime();
const pack = buildTripPack({ batches, commandCenter, complete: true, savedAt: SAVED_AT, tourManagers, travellers });

describe('trip pack store', () => {
  it('returns a saved pack until it expires, then deletes it on read', async () => {
    const store = createMemoryStore();
    await savePack(store, pack);
    expect((await loadPack(store, pack.jobCardId, SAVED_AT))?.jobCode).toBe('JC-TEST-001');
    expect(await loadPack(store, pack.jobCardId, pack.expiresAt)).toBeNull();
    expect(await store.keys('pack:')).toEqual([]);
  });

  it('purges every expired pack and keeps current ones', async () => {
    const store = createMemoryStore();
    await savePack(store, pack);
    await savePack(store, { ...pack, expiresAt: SAVED_AT - 1, jobCardId: 'jc_old' });
    expect(await purgeExpiredPacks(store, SAVED_AT)).toEqual(['jc_old']);
    expect(await store.keys('pack:')).toEqual(['pack:jc_test_1']);
  });

  it('ignores a pack written by a different format version', async () => {
    const store = createMemoryStore();
    await store.setJSON('pack:jc_test_1', { ...pack, version: 99 });
    expect(await loadPack(store, 'jc_test_1', SAVED_AT)).toBeNull();
  });
});
