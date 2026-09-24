/**
 * Keyed Mutex Utility
 * 
 * Provides per-resource asynchronous serialization (locking) to prevent 
 * concurrent write race conditions on file persistence operations.
 */

export class KeyedMutex {
  private locks = new Map<string, Promise<void>>();

  /**
   * Acquire a lock for a given resource key and execute the task exclusively.
   */
  async runExclusive<T>(key: string, task: () => Promise<T> | T): Promise<T> {
    const currentLock = this.locks.get(key) || Promise.resolve();

    let releaseLock: () => void = () => {};
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    // Update the lock chain for this key
    this.locks.set(key, currentLock.then(() => nextLock));

    try {
      // Wait for any previous task on this key to complete
      await currentLock;
      return await task();
    } finally {
      releaseLock();
      // Clean up map if this was the last lock in chain
      if (this.locks.get(key) === nextLock) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * Check if a resource key is currently locked.
   */
  isLocked(key: string): boolean {
    return this.locks.has(key);
  }
}

export const projectWriteMutex = new KeyedMutex();
