import { refusalMessage } from './outbox';
import { uploadReceipt } from './receipt-files.web';

const receipt = { fileName: 'receipt.jpg', mimeType: 'image/jpeg', size: 2048, uri: 'blob:http://localhost:8081/receipt-1' };
const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch;
});

describe('uploadReceipt in the web preview', () => {
  it('reads the picked photo and posts it to the upload URL', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(new Blob(['photo']), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ storageId: 'storage_1' }), { status: 200 }));
    await expect(uploadReceipt('https://upload.example.test/1', receipt)).resolves.toBe('storage_1');
    expect(mockFetch.mock.calls[1]?.[0]).toBe('https://upload.example.test/1');
  });

  it('says the photo is gone, instead of uploading an error page, when it can no longer be read', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Not found', { status: 404 }));
    const failure = uploadReceipt('https://upload.example.test/1', receipt);
    const error: unknown = await failure.catch((reason: unknown) => reason);
    expect(error).toHaveProperty('data', 'Receipt file missing');
    expect(refusalMessage(error)).toMatch(/no longer on this phone/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
