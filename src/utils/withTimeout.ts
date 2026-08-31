/**
 * Races a promise against a timeout. For SDK calls (Firebase Admin, Resend)
 * that don't expose their own request-level timeout/abort option, so a slow
 * or hung upstream can't hold a notification send (or the HTTP request that
 * triggered it) open indefinitely.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
