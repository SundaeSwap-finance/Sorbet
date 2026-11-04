/**
 * In-memory test double for the `chrome` extension APIs this codebase uses:
 * storage.{sync,local,session} (callback and promise forms, setAccessLevel), storage.onChanged,
 * runtime.{lastError,id,getURL,sendMessage,onMessage,onConnect}, windows.{create,remove,onRemoved}.
 *
 * Values round-trip through JSON like real chrome.storage (so `undefined` values are
 * dropped, and stored objects never alias caller objects). Callbacks run asynchronously.
 */
type AreaName = "sync" | "local" | "session";
type StorageChanges = { [key: string]: { oldValue?: unknown; newValue?: unknown } };

/** Subset of chrome.runtime.MessageSender the code under test reads. */
export interface MockSender {
  id?: string;
  origin?: string;
  url?: string;
  tab?: { id: number };
  frameId?: number;
}

type MessageListener = (
  message: unknown,
  sender: MockSender,
  sendResponse: (response?: unknown) => void
) => boolean | void | undefined;

const EXTENSION_ID = "test-extension-id";
const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`;

/** Sender of chrome.runtime.sendMessage in tests: an extension page (the popup). */
const EXTENSION_PAGE_SENDER: MockSender = {
  id: EXTENSION_ID,
  origin: EXTENSION_ORIGIN,
  url: `${EXTENSION_ORIGIN}/popup.html`,
};

/** A content script running in a web page of `origin` (top frame). */
export const webPageSender = (origin: string, tabId = 1): MockSender => ({
  id: EXTENSION_ID,
  origin,
  url: `${origin}/`,
  tab: { id: tabId },
  frameId: 0,
});

class EventMock<L extends (...args: never[]) => unknown> {
  readonly listeners = new Set<L>();
  addListener = (listener: L) => void this.listeners.add(listener);
  removeListener = (listener: L) => void this.listeners.delete(listener);
  hasListener = (listener: L) => this.listeners.has(listener);
  hasListeners = () => this.listeners.size > 0;
}

const jsonClone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

let lastError: { message: string } | undefined;
const onChanged = new EventMock<(changes: StorageChanges, areaName: AreaName) => void>();
const onMessage = new EventMock<MessageListener>();

/** Settle a chrome API call: callback form (with lastError) or promise form. */
function settle<T>(error: string | undefined, value: T, callback?: (value: T) => void): Promise<T> | void {
  if (callback) {
    queueMicrotask(() => {
      lastError = error === undefined ? undefined : { message: error };
      try {
        callback(value);
      } finally {
        lastError = undefined;
      }
    });
    return;
  }
  return error === undefined ? Promise.resolve(value) : Promise.reject(new Error(error));
}

class StorageAreaMock {
  readonly data = new Map<string, unknown>();
  readonly failures: string[] = [];

  constructor(private readonly name: AreaName) {}

  private emit(changes: StorageChanges) {
    if (Object.keys(changes).length === 0) return;
    queueMicrotask(() => onChanged.listeners.forEach((listener) => listener(changes, this.name)));
  }

  get = (
    keys?: string | string[] | Record<string, unknown> | null,
    callback?: (items: Record<string, unknown>) => void
  ) => {
    const error = this.failures.shift();
    const items: Record<string, unknown> = {};
    if (keys === null || keys === undefined) {
      this.data.forEach((value, key) => (items[key] = jsonClone(value)));
    } else if (typeof keys === "string" || Array.isArray(keys)) {
      for (const key of typeof keys === "string" ? [keys] : keys) {
        if (this.data.has(key)) items[key] = jsonClone(this.data.get(key));
      }
    } else {
      for (const [key, fallback] of Object.entries(keys)) {
        items[key] = this.data.has(key) ? jsonClone(this.data.get(key)) : fallback;
      }
    }
    return settle(error, error ? {} : items, callback);
  };

  set = (items: Record<string, unknown>, callback?: () => void) => {
    const error = this.failures.shift();
    if (!error) {
      const changes: StorageChanges = {};
      for (const [key, value] of Object.entries(jsonClone(items))) {
        if (value === undefined) continue;
        const oldValue = this.data.get(key);
        if (JSON.stringify(oldValue) === JSON.stringify(value)) continue;
        this.data.set(key, value);
        changes[key] = oldValue === undefined ? { newValue: value } : { oldValue, newValue: value };
      }
      this.emit(changes);
    }
    return settle(error, undefined, callback);
  };

  remove = (keys: string | string[], callback?: () => void) => {
    const error = this.failures.shift();
    if (!error) {
      const changes: StorageChanges = {};
      for (const key of typeof keys === "string" ? [keys] : keys) {
        if (!this.data.has(key)) continue;
        changes[key] = { oldValue: this.data.get(key) };
        this.data.delete(key);
      }
      this.emit(changes);
    }
    return settle(error, undefined, callback);
  };

  clear = (callback?: () => void) => this.remove([...this.data.keys()], callback);

  /** Records the level; the mock does not model untrusted contexts. */
  accessLevel = "TRUSTED_AND_UNTRUSTED_CONTEXTS";
  setAccessLevel = (options: { accessLevel: string }, callback?: () => void) => {
    this.accessLevel = options.accessLevel;
    return settle(undefined, undefined, callback);
  };
}

const areas: Record<AreaName, StorageAreaMock> = {
  sync: new StorageAreaMock("sync"),
  local: new StorageAreaMock("local"),
  session: new StorageAreaMock("session"),
};

/**
 * Deliver a runtime message from `sender` to every onMessage listener, like chrome does
 * across extension contexts. Resolves the first response, or an error when no listener
 * claims the message ("Receiving end does not exist").
 */
function dispatchMessage(message: unknown, sender: MockSender): Promise<{ response?: unknown; error?: string }> {
  const { promise, resolve } = Promise.withResolvers<{ response?: unknown; error?: string }>();
  let settled = false;
  const respond = (response?: unknown) => {
    if (settled) return;
    settled = true;
    resolve({ response: jsonClone(response) });
  };
  let claimed = false;
  for (const listener of onMessage.listeners) {
    if (listener(jsonClone(message), sender, respond) === true) claimed = true;
  }
  if (!claimed && !settled) {
    settled = true;
    resolve({ error: "Could not establish connection. Receiving end does not exist." });
  }
  return promise;
}

function sendMessage(message: unknown, callback?: (response: unknown) => void) {
  const done = dispatchMessage(message, EXTENSION_PAGE_SENDER).then(({ response, error }) => {
    if (callback) {
      lastError = error === undefined ? undefined : { message: error };
      try {
        callback(response);
      } finally {
        lastError = undefined;
      }
      return response;
    }
    if (error !== undefined) throw new Error(error);
    return response;
  });
  return callback ? undefined : done;
}

/** Send a runtime message as `sender` (e.g. `webPageSender(origin)`); resolves the reply. */
export async function sendMessageFrom(sender: MockSender, message: unknown): Promise<unknown> {
  const { response, error } = await dispatchMessage(message, sender);
  if (error !== undefined) throw new Error(error);
  return response;
}

let nextWindowId = 1;
const openWindows = new Map<number, { url?: string }>();
const onWindowRemoved = new EventMock<(windowId: number) => void>();
const onConnect = new EventMock<(port: unknown) => void>();

function closeWindowInternal(windowId: number): boolean {
  if (!openWindows.delete(windowId)) return false;
  queueMicrotask(() => onWindowRemoved.listeners.forEach((listener) => listener(windowId)));
  return true;
}

const windows = {
  create: (data: { url?: string }, callback?: (window: { id: number }) => void) => {
    const id = nextWindowId++;
    openWindows.set(id, { url: data.url });
    return settle(undefined, { id }, callback);
  },
  remove: (windowId: number, callback?: () => void) =>
    settle(closeWindowInternal(windowId) ? undefined : `No window with id: ${windowId}.`, undefined, callback),
  onRemoved: onWindowRemoved,
};

const chromeMock = {
  runtime: {
    id: EXTENSION_ID,
    get lastError() {
      return lastError;
    },
    getURL: (path: string) => `${EXTENSION_ORIGIN}/${path.replace(/^\//, "")}`,
    sendMessage,
    onMessage,
    onConnect,
  },
  storage: { ...areas, onChanged },
  windows,
};

/** Windows opened via chrome.windows.create and not yet closed. */
export function getOpenWindows(): Array<{ id: number; url?: string }> {
  return [...openWindows].map(([id, window]) => ({ id, ...window }));
}

/** Simulate the user closing a window (fires chrome.windows.onRemoved). */
export function userClosesWindow(windowId: number): void {
  closeWindowInternal(windowId);
}

export function installChromeMock(): void {
  Object.assign(globalThis, { chrome: chromeMock });
}

export function resetChromeMock(): void {
  for (const area of Object.values(areas)) {
    area.data.clear();
    area.failures.length = 0;
  }
  onChanged.listeners.clear();
  onMessage.listeners.clear();
  onConnect.listeners.clear();
  onWindowRemoved.listeners.clear();
  openWindows.clear();
  lastError = undefined;
}

/** Make the next storage operation on `area` fail with chrome.runtime.lastError = message. */
export function failNextStorageOperation(area: AreaName, message = "QUOTA_BYTES_PER_ITEM quota exceeded"): void {
  areas[area].failures.push(message);
}

/** Seed raw storage contents (no onChanged events). */
export function setStorageData(area: AreaName, items: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(jsonClone(items))) areas[area].data.set(key, value);
}

/** Snapshot raw storage contents. */
export function getStorageData(area: AreaName): Record<string, unknown> {
  return Object.fromEntries([...areas[area].data].map(([key, value]) => [key, jsonClone(value)]));
}

/** Resolve after queued chrome callbacks and onChanged events have run. */
export function flushChrome(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 0);
  return promise;
}
