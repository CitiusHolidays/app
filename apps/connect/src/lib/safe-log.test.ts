import { ConvexError } from 'convex/values';

import { errorCategory, logEvent } from './safe-log';

describe('safe logging', () => {
  it('reduces errors to a category without their message', () => {
    expect(errorCategory(new ConvexError('Traveller Asha Example not found'))).toBe('server-refused');
    expect(errorCategory(new TypeError('Network request failed'))).toBe('network');
    expect(errorCategory('+91 90000 00000')).toBe('unknown');
  });

  it('never writes the error text to the console', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    logEvent('outbox.step-failed', new Error('Expense for Asha Example, INR 1200'));
    expect(warn).toHaveBeenCalledWith('[connect] outbox.step-failed (Error)');
    warn.mockRestore();
  });
});
