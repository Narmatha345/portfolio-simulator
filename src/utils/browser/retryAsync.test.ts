import { retryAsync } from './retryAsync';

describe('retryAsync', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryAsync(fn, { attempts: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries after a failure and succeeds within the attempt budget', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('429 throttled')).mockResolvedValueOnce('ok');
    const result = await retryAsync(fn, { attempts: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws the last error once all attempts are exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('still throttled'));
    await expect(retryAsync(fn, { attempts: 3, baseDelayMs: 1 })).rejects.toThrow('still throttled');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
