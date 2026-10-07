/** Coalesce concurrent reads only. Settled values are never cached, including failures. */
export function createInFlightRead<T>() {
  const pending = new Map<string, Promise<T>>();
  return (key: string, read: () => Promise<T>): Promise<T> => {
    const existing = pending.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(read);
    pending.set(key, request);
    const clear = () => { if (pending.get(key) === request) pending.delete(key); };
    void request.then(clear, clear);
    return request;
  };
}
