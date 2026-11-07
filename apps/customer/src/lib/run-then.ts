/**
 * Runs `task`, then `cleanup` whether the task resolved or threw; a rejection still reaches the
 * caller. Screens use it to clear a busy flag on every path: React Compiler cannot compile a
 * `finally` inside a component, so the `finally` lives here instead.
 */
export async function runThen<T>(task: () => Promise<T>, cleanup: () => void): Promise<T> {
  try {
    return await task();
  } finally {
    cleanup();
  }
}
