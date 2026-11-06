import { fakeFileSystem } from '@/test/fake-file-system';

import { deleteAllPassportPdfs, deletePassportPdf, writePassportPdf } from './passport-pdf-file';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-file-system', () => require('@/test/fake-file-system').fakeFileSystem.module);
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}` }));

const CACHE = 'file:///app/Library/Caches';
const BYTES = new TextEncoder().encode('%PDF-1.7 synthetic passport');

describe('passport PDF view file', () => {
  beforeEach(() => fakeFileSystem.reset());

  it('writes the bytes to one randomly named file in the private cache, and nowhere else', () => {
    const uri = writePassportPdf(BYTES.buffer);
    expect(uri).toMatch(new RegExp(`^${CACHE}/passport-view/[0-9a-f-]{36}\\.pdf$`));
    expect([...fakeFileSystem.files.keys()]).toEqual([uri]);
    expect(fakeFileSystem.files.get(uri)).toEqual(BYTES);
    // Never the documents folder, which phone backups copy.
    expect(fakeFileSystem.log.some((entry) => entry.includes('/Documents'))).toBe(false);
    // A second open gets a new name, so no name says whose passport it is or repeats.
    const second = writePassportPdf(BYTES.buffer);
    expect(second).not.toBe(uri);
    expect(second).not.toMatch(/passport\.pdf$/);
  });

  it('deletes the file it wrote', () => {
    const uri = writePassportPdf(BYTES.buffer);
    deletePassportPdf(uri);
    expect(fakeFileSystem.files.size).toBe(0);
    // Deleting twice (unmount after background, say) is harmless.
    expect(() => deletePassportPdf(uri)).not.toThrow();
  });

  it('deletes every leftover view file at once, and is harmless when there are none', () => {
    writePassportPdf(BYTES.buffer);
    writePassportPdf(BYTES.buffer);
    deleteAllPassportPdfs();
    expect(fakeFileSystem.files.size).toBe(0);
    expect(fakeFileSystem.directories.has(`${CACHE}/passport-view`)).toBe(false);
    expect(() => deleteAllPassportPdfs()).not.toThrow();
  });
});
