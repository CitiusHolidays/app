import { serialRunner } from './serial-runner';

/** A task that runs until the test lets it finish. */
function gate() {
  let open: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { done, open };
}

describe('serial runner', () => {
  it('runs a task straight away when nothing is running', async () => {
    const request = serialRunner(jest.fn());
    const task = jest.fn(async () => undefined);
    await request(task);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('never runs two at once, and runs once more after a run asked for during it', async () => {
    const request = serialRunner(jest.fn());
    const log: string[] = [];
    const first = gate();
    const running = request(async () => {
      log.push('first start');
      await first.done;
      log.push('first end');
    });
    await request(async () => {
      log.push('second');
    });
    expect(log).toEqual(['first start']);
    first.open();
    await running;
    expect(log).toEqual(['first start', 'first end', 'second']);
  });

  it('turns many requests during a run into exactly one more run, with the newest task', async () => {
    const request = serialRunner(jest.fn());
    const first = gate();
    const older = jest.fn(async () => undefined);
    const newest = jest.fn(async () => undefined);
    const running = request(() => first.done);
    void request(older);
    void request(older);
    void request(newest);
    first.open();
    await running;
    expect(older).not.toHaveBeenCalled();
    expect(newest).toHaveBeenCalledTimes(1);
  });

  it('runs again for a request that arrives after a run ended', async () => {
    const request = serialRunner(jest.fn());
    const task = jest.fn(async () => undefined);
    await request(task);
    await request(task);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('reports a failed task and still runs the one asked for after it', async () => {
    const onError = jest.fn();
    const request = serialRunner(onError);
    const first = gate();
    const after = jest.fn(async () => undefined);
    const running = request(async () => {
      await first.done;
      throw new Error('boom');
    });
    void request(after);
    first.open();
    await running;
    expect(onError).toHaveBeenCalledWith(new Error('boom'));
    expect(after).toHaveBeenCalledTimes(1);
    // And it is free for the next request.
    await request(after);
    expect(after).toHaveBeenCalledTimes(2);
  });
});
