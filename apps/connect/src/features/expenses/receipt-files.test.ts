import { deleteAllReceipts, keepReceipt, receiptSize } from './receipt-files';

const mockResize = jest.fn();
const mockSave = jest.fn();
let mockManipulateFails = false;

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: () => {
      if (mockManipulateFails) throw new Error('decode failed');
      const context = {
        renderAsync: async () => ({ saveAsync: mockSave }),
        resize: (size: unknown) => {
          mockResize(size);
          return context;
        },
      };
      return context;
    },
  },
  SaveFormat: { JPEG: 'jpeg' },
}));

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
    mockResize.mockReset();
    mockSave.mockReset();
    mockSave.mockResolvedValue({ height: 1536, uri: 'file:///manipulator/out.jpg', width: 2048 });
    mockManipulateFails = false;
  });

  it('shrinks a camera photo once, to a sharp 3G-friendly JPEG, before keeping it', async () => {
    const receipt = await keepReceipt({ height: 3024, mimeType: 'image/heic', uri: 'file:///picker/tmp.heic', width: 4032 }, 'exp_2');
    expect(mockResize).toHaveBeenCalledWith({ height: null, width: 2048 });
    expect(mockSave).toHaveBeenCalledWith({ compress: 0.8, format: 'jpeg' });
    expect(receipt).toMatchObject({ mimeType: 'image/jpeg', uri: 'file:///app/Library/Caches/receipts/exp_2.jpg' });
  });

  it('keeps the original when the photo cannot be shrunk, so no receipt is lost', async () => {
    mockManipulateFails = true;
    const receipt = await keepReceipt({ height: 3024, mimeType: 'image/png', uri: 'file:///picker/tmp.png', width: 4032 }, 'exp_3');
    expect(receipt).toMatchObject({ mimeType: 'image/png', uri: 'file:///app/Library/Caches/receipts/exp_3.png' });
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

describe('receiptSize', () => {
  it('caps the long edge at 2048 and never enlarges', () => {
    expect(receiptSize(4032, 3024)).toEqual({ height: null, width: 2048 });
    expect(receiptSize(3024, 4032)).toEqual({ height: 2048, width: null });
    expect(receiptSize(2048, 1536)).toBeNull();
    expect(receiptSize(1200, 900)).toBeNull();
    expect(receiptSize(undefined, undefined)).toBeNull();
  });
});
