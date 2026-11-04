import { createSerialQueue, onStorageChanged, storageGet, storageSet } from "../utils/storage";
import { WalletLog } from "./walletLog";

const LOG_SCROLLBACK_LENGTH_DEFAULT = 30;
export const LOG_SCROLLBACK_LENGTH_MAX = 1000,
  WALLET_LOG_MAX_ENTRY_CHARS = 100_000,
  WALLET_LOG_MAX_TOTAL_CHARS = 2_000_000;
const WALLET_LOG_STORAGE_KEY = "walletLogs",
  WALLET_LOG_SCROLLBACK_STORAGE_KEY = "walletLogScrollback";

const enqueue = createSerialQueue();

/** Parse a persisted/typed scrollback value: integer in 1..1000, otherwise the default. */
export function parseWalletLogScrollback(raw: unknown): number {
  const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isInteger(value)) return LOG_SCROLLBACK_LENGTH_DEFAULT;
  return Math.min(Math.max(value, 1), LOG_SCROLLBACK_LENGTH_MAX);
}

/** Validate the WalletLog shape and size; throws on anything else. */
function parseWalletLog(entry: unknown): WalletLog {
  if (typeof entry !== "object" || entry === null) throw new Error("Wallet log must be an object");
  const { methodName, args, result, created, origin } = entry as Record<string, unknown>;
  if (typeof methodName !== "string" || methodName === "") {
    throw new Error("Wallet log methodName must be a non-empty string");
  }
  if (!Array.isArray(args)) throw new Error("Wallet log args must be an array");
  if (typeof created !== "number" || !Number.isFinite(created)) {
    throw new Error("Wallet log created must be a finite number");
  }
  if (origin !== undefined && typeof origin !== "string") throw new Error("Wallet log origin must be a string");
  const parsed = { methodName, args, result, created, ...(origin === undefined ? {} : { origin }) };
  const serialized = JSON.stringify(parsed);
  if (serialized === undefined || serialized.length > WALLET_LOG_MAX_ENTRY_CHARS) {
    throw new Error("Wallet log entry is not serializable or is too large");
  }
  return parsed as WalletLog;
}

/** Keep only well-formed entries from persisted data. */
function parseStoredLogs(raw: unknown): WalletLog[] {
  if (!Array.isArray(raw)) return [];
  const logs: WalletLog[] = [];
  for (const item of raw) {
    try {
      logs.push(parseWalletLog(item));
    } catch {
      // Drop corrupt persisted entries.
    }
  }
  return logs;
}

/** Newest `scrollback` entries. */
function trimLogs(logs: WalletLog[], scrollback: number): WalletLog[] {
  return logs.length > scrollback ? logs.slice(logs.length - scrollback) : logs;
}

/** Drop the oldest entries until the serialized array is at most WALLET_LOG_MAX_TOTAL_CHARS. */
function capLogSize(logs: WalletLog[]): WalletLog[] {
  // Serialized array = "[" + entries joined by "," + "]".
  let total = 2 + Math.max(logs.length - 1, 0);
  let keepFrom = logs.length;
  while (keepFrom > 0) {
    total += JSON.stringify(logs[keepFrom - 1]).length;
    if (total > WALLET_LOG_MAX_TOTAL_CHARS) break;
    keepFrom--;
  }
  return keepFrom === 0 ? logs : logs.slice(keepFrom);
}

/** Retrieve log scrollback */
export async function getWalletLogScrollback(): Promise<number> {
  const stored = await storageGet("local", [WALLET_LOG_SCROLLBACK_STORAGE_KEY]);
  return parseWalletLogScrollback(stored[WALLET_LOG_SCROLLBACK_STORAGE_KEY]);
}

/** Store log scrollback (clamped to 1..1000). Resolves to the stored value. */
export async function saveWalletLogScrollback(scrollbackLength: unknown): Promise<number> {
  const scrollback = parseWalletLogScrollback(scrollbackLength);
  await storageSet("local", { [WALLET_LOG_SCROLLBACK_STORAGE_KEY]: scrollback });
  return scrollback;
}

/** Retrieve logs, trimmed to the scrollback length. */
export async function retrieveWalletLogs(): Promise<WalletLog[]> {
  const stored = await storageGet("local", [
    WALLET_LOG_STORAGE_KEY,
    WALLET_LOG_SCROLLBACK_STORAGE_KEY,
  ]);
  return trimLogs(
    parseStoredLogs(stored[WALLET_LOG_STORAGE_KEY]),
    parseWalletLogScrollback(stored[WALLET_LOG_SCROLLBACK_STORAGE_KEY])
  );
}

/** Validate and append a log entry; serialized so concurrent appends are all kept. */
export function appendWalletLog(entry: unknown): Promise<void> {
  let log: WalletLog;
  try {
    log = parseWalletLog(entry);
  } catch (error) {
    return Promise.reject(error);
  }
  return enqueue(async () => {
    const stored = await storageGet("local", [
      WALLET_LOG_STORAGE_KEY,
      WALLET_LOG_SCROLLBACK_STORAGE_KEY,
    ]);
    const logs = capLogSize(
      trimLogs(
        [...parseStoredLogs(stored[WALLET_LOG_STORAGE_KEY]), log],
        parseWalletLogScrollback(stored[WALLET_LOG_SCROLLBACK_STORAGE_KEY])
      )
    );
    await storageSet("local", { [WALLET_LOG_STORAGE_KEY]: logs });
  });
}

/** Subscribe to log or scrollback changes. Returns the unsubscribe function. */
export function onWalletLogsChanged(listener: () => void): () => void {
  return onStorageChanged(
    "local",
    [WALLET_LOG_STORAGE_KEY, WALLET_LOG_SCROLLBACK_STORAGE_KEY],
    listener
  );
}
