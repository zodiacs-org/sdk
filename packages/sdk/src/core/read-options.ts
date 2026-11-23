/** Optional cancellation and deadline for one complete read, including any fallback. */
export interface ReadOptions {
  /** Cancels the read with the caller's abort reason. */
  readonly signal?: AbortSignal;
  /** Whole milliseconds from 0 to 2147483647. Zero expires before dispatch. */
  readonly timeoutMs?: number;
}

// A twelve-sign read can share one signal across every reader. Keep one event listener
// per signal, and detach individual callbacks as their operations settle.
const subscriptions = new WeakMap<
  AbortSignal,
  { callbacks: Set<() => void>; notify: () => void }
>();

function subscribe(signal: AbortSignal, callback: () => void): () => void {
  let group = subscriptions.get(signal);
  if (!group) {
    const callbacks = new Set<() => void>();
    const notify = () => callbacks.forEach((listener) => listener());
    group = { callbacks, notify };
    subscriptions.set(signal, group);
    signal.addEventListener("abort", notify);
  }
  const { callbacks, notify } = group;
  callbacks.add(callback);
  return () => {
    callbacks.delete(callback);
    if (!callbacks.size) {
      signal.removeEventListener("abort", notify);
      subscriptions.delete(signal);
    }
  };
}

/** Race even a non-cooperative transport and release the timer and listeners on every exit. */
export async function runRead<T>(
  { signal, timeoutMs }: ReadOptions,
  read: (controls: Pick<ReadOptions, "signal">) => Promise<T>
): Promise<T> {
  signal?.throwIfAborted();
  if (
    timeoutMs !== undefined &&
    (!Number.isInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 2147483647)
  ) {
    throw new RangeError("timeoutMs must be an integer between 0 and 2147483647.");
  }
  if (timeoutMs === undefined && !signal) return read({});

  const timeoutReason = () => new DOMException("Read timed out.", "TimeoutError");
  if (timeoutMs === 0) throw timeoutReason();

  const deadline = timeoutMs === undefined ? undefined : new AbortController();
  const active = deadline?.signal ?? signal!;
  const timer = deadline ? setTimeout(() => deadline.abort(timeoutReason()), timeoutMs) : undefined;
  const stopForwarding =
    deadline && signal ? subscribe(signal, () => deadline.abort(signal.reason)) : undefined;

  let unsubscribe: (() => void) | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      // A client can abort synchronously during dispatch.
      unsubscribe = subscribe(active, () => reject(active.reason));
      read({ signal: active }).then(resolve, reject);
    });
  } catch (error) {
    // Stop sibling RPCs still using this deadline when a composite read fails early.
    deadline?.abort(error);
    throw error;
  } finally {
    clearTimeout(timer);
    unsubscribe?.();
    stopForwarding?.();
  }
}
