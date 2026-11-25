/**
 * Waits, unless aborted first. Poll loops call this every lap on one long-lived signal,
 * so the abort listener comes off again when the wait ends normally, or every lap would
 * leave one behind until the signal finally fires.
 * @param ms - How long.
 * @param signal - Cuts the wait short.
 * @returns Resolves when the time is up or the signal fires.
 */
export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
