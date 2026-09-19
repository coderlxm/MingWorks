import pLimit from 'p-limit';
import { AsyncLocalStorage } from 'node:async_hooks';

const startggTaskLimit = pLimit(1);
const taskContext = new AsyncLocalStorage<{ active: boolean }>();

// A business operation holds the queue through collection and scheduling changes.
// Nested collection calls remain part of that same operation.
export function runStartggTask<T>(task: () => Promise<T>): Promise<T> {
  if (taskContext.getStore()?.active) return task();
  return queueStartggTask(task);
}

export function queueStartggTask<T>(task: () => Promise<T>): Promise<T> {
  return startggTaskLimit(() => {
    const context = { active: true };
    return taskContext.run(context, async () => {
      try { return await task(); }
      finally { context.active = false; }
    });
  });
}

export function getStartggTaskQueueStatus() {
  return { busy: startggTaskLimit.activeCount > 0 || startggTaskLimit.pendingCount > 0, queuedTasks: startggTaskLimit.pendingCount };
}
