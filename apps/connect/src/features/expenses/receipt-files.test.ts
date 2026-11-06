import { deleteAllReceipts, keepReceipt } from './receipt-files';

const mockDeleted: string[] = [];
const mockCopies: string[] = [];

jest.mock('expo-file-system', () => {
  const pathOf = (parent: unknown, name?: string) =>
    [typeof parent === 'string' ? parent : (parent as { uri: string }).uri, name].filter(Boolean).join('/');
  class Directory {
    uri: string;
    constructor(parent: unknown, name?: string) {
      this.uri = pathOf(parent, name);
    }
    get exists() {
      return true;
    }
    create() {}
    delete() {
      mockDeleted.push(this.uri);
    }
  }
  class File {
    uri: string;
    size = 2048;
    constructor(parent: unknown, name?: string) {
      this.uri = pathOf(parent, name);
    }
    async copy(destination: { uri: string }) {
      mockCopies.push(destination.uri);
    }
  }
  return {
    Directory,
    File,
    // Documents are backed up to iCloud and Android Auto Backup; caches are not.
    Paths: { cache: { uri: 'file:///app/Library/Caches' }, document: { uri: 'file:///app/Documents' } },
  };
});

describe('receipt files', () => {
  beforeEach(() => {
    mockDeleted.length = 0;
    mockCopies.length = 0;
  });

  it('keeps receipt photos where device backups do not copy them', async () => {
    const receipt = await keepReceipt({ mimeType: 'image/jpeg', uri: 'file:///picker/tmp.jpg' }, 'exp_1');
    expect(receipt.uri).toBe('file:///app/Library/Caches/receipts/exp_1.jpg');
    expect(mockCopies).toEqual(['file:///app/Library/Caches/receipts/exp_1.jpg']);
  });

  it('deletes receipts from the cache, and from the documents folder used by earlier builds', () => {
    deleteAllReceipts();
    expect(mockDeleted.sort()).toEqual(['file:///app/Documents/receipts', 'file:///app/Library/Caches/receipts']);
  });
});
