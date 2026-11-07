import { runThen } from './run-then';

describe('runThen', () => {
  it('returns the result and then cleans up', async () => {
    const order: string[] = [];
    const value = await runThen(
      async () => {
        order.push('task');
        return 7;
      },
      () => order.push('cleanup')
    );
    expect(value).toBe(7);
    expect(order).toEqual(['task', 'cleanup']);
  });

  it('cleans up when the task throws, and still throws', async () => {
    const cleanup = jest.fn();
    await expect(
      runThen(async () => {
        throw new Error('offline');
      }, cleanup)
    ).rejects.toThrow('offline');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
