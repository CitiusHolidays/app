import { useCallback, useState } from 'react';

type Task = () => Promise<void>;

/**
 * Runs one task at a time. A request while a task is running does not start another: it
 * schedules exactly one more run for when the current one ends, however many requests came in,
 * and that run uses the newest task (which reads the queue as it is then). A task that throws is
 * reported and does not stop the run that was asked for after it.
 */
export function serialRunner(onError: (error: unknown) => void) {
  let running = false;
  let next: Task | null = null;
  return async function request(task: Task) {
    next = task;
    if (running) return;
    running = true;
    while (next) {
      const current: Task = next;
      next = null;
      try {
        await current();
      } catch (error) {
        onError(error);
      }
    }
    running = false;
  };
}

/** `task`, run through one serial runner for the component's lifetime. */
export function useSerialRun(task: Task, onError: (error: unknown) => void) {
  const [request] = useState(() => serialRunner(onError));
  return useCallback(() => request(task), [request, task]);
}
