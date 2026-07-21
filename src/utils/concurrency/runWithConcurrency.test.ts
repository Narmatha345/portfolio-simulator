import { runWithConcurrency } from './runWithConcurrency';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('runWithConcurrency', () => {
  it('never runs more than `concurrency` workers at once', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    await runWithConcurrency({
      items,
      concurrency: 3,
      worker: async (item) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return item * 2;
      },
    });

    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it('settles every item exactly once, fulfilled or rejected', async () => {
    const items = [1, 2, 3, 4, 5];
    const settled: number[] = [];
    const fulfilled: number[] = [];
    const rejected: number[] = [];

    await runWithConcurrency({
      items,
      concurrency: 2,
      worker: async (item) => {
        if (item === 3) throw new Error('boom');
        return item;
      },
      onItemSettled: (r) => {
        settled.push(r.index);
        if (r.status === 'fulfilled') fulfilled.push(r.value);
        else rejected.push(r.index);
      },
    });

    expect(settled.sort()).toEqual([0, 1, 2, 3, 4]);
    expect(fulfilled.sort()).toEqual([1, 2, 4, 5]);
    expect(rejected).toEqual([2]);
  });

  it('stops picking up new work once cancelled, without throwing', async () => {
    let cancelled = false;
    let started = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    const gate = deferred<void>();

    const run = runWithConcurrency({
      items,
      concurrency: 2,
      isCancelled: () => cancelled,
      worker: async (item) => {
        started++;
        if (item === 1) {
          cancelled = true;
          await gate.promise;
        }
        return item;
      },
    });

    // Let the first couple of workers start, then release the gate.
    await new Promise((r) => setTimeout(r, 10));
    gate.resolve();
    await run;

    expect(started).toBeLessThan(items.length);
  });

  it('yields to the event loop between items instead of running as one uninterrupted burst', async () => {
    // Regression test: when every worker resolves instantly (e.g. a fully cached scan),
    // promises used to settle back-to-back as microtasks with no gap for the browser to
    // repaint, freezing the tab. A real macrotask scheduled before the run should now
    // land somewhere in the middle of the sequence, proving execution actually yielded.
    const order: string[] = [];
    const items = Array.from({ length: 20 }, (_, i) => i);

    setTimeout(() => order.push('external-macrotask'), 0);

    await runWithConcurrency({
      items,
      concurrency: 1,
      worker: async (item) => {
        order.push(`item-${item}`);
        return item;
      },
    });

    const macrotaskIndex = order.indexOf('external-macrotask');
    expect(macrotaskIndex).toBeGreaterThan(0);
    expect(macrotaskIndex).toBeLessThan(order.length - 1);
  });

  it('can disable yielding via yieldToMainThread: false', async () => {
    const order: string[] = [];
    const items = Array.from({ length: 20 }, (_, i) => i);

    setTimeout(() => order.push('external-macrotask'), 0);

    await runWithConcurrency({
      items,
      concurrency: 1,
      yieldToMainThread: false,
      worker: async (item) => {
        order.push(`item-${item}`);
        return item;
      },
    });

    // With no yielding, all 20 items resolve via microtasks before the browser/Node
    // ever gets to the externally scheduled macrotask (which only fires once we
    // explicitly hand control back here).
    await new Promise((r) => setTimeout(r, 0));
    expect(order.slice(0, 20)).toEqual(items.map((i) => `item-${i}`));
    expect(order[20]).toBe('external-macrotask');
  });
});
