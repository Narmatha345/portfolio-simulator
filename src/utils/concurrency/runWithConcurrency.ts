export type SettledResult<T, R> =
  | { item: T; index: number; status: 'fulfilled'; value: R }
  | { item: T; index: number; status: 'rejected'; error: unknown };

export interface RunWithConcurrencyOptions<T, R> {
  items: T[];
  concurrency: number;
  worker: (item: T, index: number) => Promise<R>;
  isCancelled?: () => boolean;
  onItemSettled?: (result: SettledResult<T, R>) => void;
  /**
   * Yield to the browser's event loop after every item (default true). When every
   * worker resolves near-instantly (e.g. a fully cached scan), promises settle back
   * to back as microtasks with no natural gap for the page to repaint or respond to
   * input — this forces a real macrotask breath so a fast, cache-heavy run can't
   * freeze the tab.
   */
  yieldToMainThread?: boolean;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Runs `worker` over `items` with at most `concurrency` in flight at once, calling
 * `onItemSettled` as each one resolves (so callers can render progressively / show
 * "Calculating N of M"). Checked before and after each task so cancellation stops
 * picking up new work quickly without needing to abort in-flight requests.
 */
export async function runWithConcurrency<T, R>(options: RunWithConcurrencyOptions<T, R>): Promise<void> {
  const { items, worker, onItemSettled } = options;
  const isCancelled = options.isCancelled ?? (() => false);
  const concurrency = Math.max(1, Math.min(options.concurrency, items.length || 1));
  const shouldYield = options.yieldToMainThread ?? true;

  let nextIndex = 0;

  async function runNext(): Promise<void> {
    while (nextIndex < items.length) {
      if (isCancelled()) return;
      const index = nextIndex++;
      const item = items[index];
      try {
        const value = await worker(item, index);
        if (isCancelled()) return;
        onItemSettled?.({ item, index, status: 'fulfilled', value });
      } catch (error) {
        if (isCancelled()) return;
        onItemSettled?.({ item, index, status: 'rejected', error });
      }
      if (shouldYield) await yieldToEventLoop();
    }
  }

  const workers = Array.from({ length: concurrency }, () => runNext());
  await Promise.all(workers);
}
