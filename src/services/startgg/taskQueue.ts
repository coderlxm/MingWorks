import pLimit from 'p-limit';

const startggTaskLimit = pLimit(1);

export function runStartggTask<T>(task: () => Promise<T>): Promise<T> {
  return startggTaskLimit(task);
}
