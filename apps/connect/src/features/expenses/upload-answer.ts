/** The storage id in a Convex upload answer, or null when the answer is not the expected JSON. */
export function storageIdOf(answer: unknown) {
  const storageId = typeof answer === 'object' && answer !== null && 'storageId' in answer ? answer.storageId : undefined;
  return typeof storageId === 'string' && storageId ? storageId : null;
}
