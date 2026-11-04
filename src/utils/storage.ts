export type StorageAreaName = "sync" | "local" | "session";
export type StorageChanges = { [key: string]: chrome.storage.StorageChange };

const storageArea = (areaName: StorageAreaName): chrome.storage.StorageArea =>
  chrome.storage[areaName];

/** Run a chrome callback API and settle on chrome.runtime.lastError. */
function withLastError<T>(run: (done: (value: T) => void) => void): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  run((value) => {
    const error = chrome.runtime.lastError;
    if (error) {
      reject(new Error(error.message ?? "chrome.storage operation failed"));
    } else {
      resolve(value);
    }
  });
  return promise;
}

/** Read `keys` from a storage area. Missing keys are absent from the result. */
export function storageGet(
  areaName: StorageAreaName,
  keys: readonly string[]
): Promise<Record<string, unknown>> {
  return withLastError((done) => storageArea(areaName).get([...keys], (items) => done(items)));
}

/** Write `items` to a storage area. Rejects when chrome reports an error (e.g. quota). */
export function storageSet(areaName: StorageAreaName, items: Record<string, unknown>): Promise<void> {
  return withLastError((done) => storageArea(areaName).set(items, () => done(undefined)));
}

/** Delete `keys` from a storage area. */
export function storageRemove(areaName: StorageAreaName, keys: readonly string[]): Promise<void> {
  return withLastError((done) => storageArea(areaName).remove([...keys], () => done(undefined)));
}

/**
 * Subscribe to changes of `keys` in one storage area. The listener only fires when at
 * least one of `keys` changed in `areaName`. Returns the unsubscribe function.
 */
export function onStorageChanged(
  areaName: StorageAreaName,
  keys: readonly string[],
  listener: (changes: StorageChanges) => void
): () => void {
  const handler = (changes: StorageChanges, changedArea: string) => {
    if (changedArea !== areaName) return;
    if (!keys.some((key) => key in changes)) return;
    listener(changes);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/**
 * Serialize async read-modify-write tasks within one JS context. Each task starts after
 * the previous one settles; a failed task does not block later ones.
 */
export function createSerialQueue(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };
}
