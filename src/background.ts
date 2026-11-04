import type { TPaginate } from "../typings/cip30";
import { appendWalletLog } from "./modules/walletLogStorageHandler";
import { addAddress } from "./modules/addressBookStorage";
import { getSitePermission, grantSitePermission, siteOrigin } from "./modules/sitePermissions";
import { RefusedError, decideApproval, getApproval, requestApproval } from "./background/approvals";
import {
  AnyBackgroundRequest,
  ApprovalKind,
  BackgroundAction,
  BackgroundReply,
  BackgroundResponseData,
  WalletConfigReply,
  isBackgroundRequest,
} from "./protocol";
import { WALLET_INJECTION_KEYS, loadSettings, saveSettings } from "./settings";
import { Quantity, UTxO } from "./types";
import { isValidAddress, networkIdFromAddress, stakeKeyFromAddress } from "./utils/addresses";
import { computeBalanceFromAmounts } from "./utils/balance";
import { Log } from "./utils/log_util";
import { createSerialQueue, storageGet, storageSet } from "./utils/storage";
import { encodeUtxos } from "./utils/utxo";

// --- Blockfrost API with exponential backoff ---

const MAX_RETRIES = 5;
/** Blockfrost returns at most 100 items per page. */
const BLOCKFROST_PAGE_SIZE = 100;
/** At most this many Blockfrost fetches are in flight across the worker. */
const MAX_CONCURRENT_FETCHES = 8;

let fetchesInFlight = 0;
const fetchWaiters: Array<() => void> = [];

/** Run `task` once one of the shared fetch slots is free. */
async function withFetchSlot<T>(task: () => Promise<T>): Promise<T> {
  if (fetchesInFlight >= MAX_CONCURRENT_FETCHES) {
    // The releasing task hands its slot over, so the count stays at the maximum.
    const { promise, resolve } = Promise.withResolvers<void>();
    fetchWaiters.push(resolve);
    await promise;
  } else {
    fetchesInFlight++;
  }
  try {
    return await task();
  } finally {
    const next = fetchWaiters.shift();
    if (next) next();
    else fetchesInFlight--;
  }
}

class BlockfrostError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "BlockfrostError";
  }
}

async function blockfrostApiKey(mainnet: boolean): Promise<string> {
  const keys = await loadSettings(["blockfrostMainnetApiKey", "blockfrostPreviewApiKey"]);
  const key = mainnet ? keys.blockfrostMainnetApiKey : keys.blockfrostPreviewApiKey;
  if (!key) {
    throw new Error(`Blockfrost ${mainnet ? "mainnet" : "preview"} API key is not set`);
  }
  return key;
}

/** GET a Blockfrost endpoint and return its JSON body. Only 429 is retried. */
async function callBlockfrost(
  mainnet: boolean,
  path: string,
  params: Record<string, string>,
  retryCount = 0
): Promise<unknown> {
  const blockfrostUrl = mainnet
    ? "https://cardano-mainnet.blockfrost.io"
    : "https://cardano-preview.blockfrost.io";
  const requestUrl = new URL(path, blockfrostUrl);
  for (const [key, value] of Object.entries(params)) {
    requestUrl.searchParams.append(key, value);
  }

  const headers = { project_id: await blockfrostApiKey(mainnet) };
  const res = await withFetchSlot(() => fetch(requestUrl, { method: "GET", headers }));

  if (res.status === 429) {
    if (retryCount >= MAX_RETRIES) {
      throw new BlockfrostError(
        429,
        `Blockfrost rate limit exceeded after ${MAX_RETRIES} retries for ${path}`
      );
    }
    const delay = Math.min(200 * Math.pow(2, retryCount), 5000);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return callBlockfrost(mainnet, path, params, retryCount + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new BlockfrostError(res.status, `Blockfrost API error ${res.status} for ${path}: ${body}`);
  }

  return res.json();
}

/**
 * Fetch one page of a list endpoint keyed by an address or account. For these endpoints a
 * 404 means "never seen on-chain", i.e. a genuinely empty list; every other failure throws.
 */
async function fetchListPage(
  mainnet: boolean,
  path: string,
  page: number
): Promise<unknown[]> {
  let body: unknown;
  try {
    body = await callBlockfrost(mainnet, path, {
      count: BLOCKFROST_PAGE_SIZE.toString(),
      page: page.toString(),
    });
  } catch (err) {
    if (err instanceof BlockfrostError && err.status === 404) return [];
    throw err;
  }
  if (!Array.isArray(body)) throw new Error(`Blockfrost returned a non-list body for ${path}`);
  return body;
}

/** Fetch pages until one comes back short; later pages are only requested after a full page. */
async function fetchAllPages(mainnet: boolean, path: string): Promise<unknown[]> {
  const items: unknown[] = [];
  for (let page = 1; ; page++) {
    const pageItems = await fetchListPage(mainnet, path, page);
    items.push(...pageItems);
    if (pageItems.length < BLOCKFROST_PAGE_SIZE) return items;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function parseQuantity(value: unknown): Quantity {
  if (!isRecord(value) || typeof value.unit !== "string" || typeof value.quantity !== "string") {
    throw new Error("Malformed Blockfrost amount");
  }
  return { unit: value.unit, quantity: value.quantity };
}

/** Parse the untrusted JSON of a Blockfrost UTxO into the exact UTxO type. */
function parseUtxo(value: unknown): UTxO {
  if (
    !isRecord(value) ||
    typeof value.address !== "string" ||
    typeof value.tx_hash !== "string" ||
    typeof value.output_index !== "number" ||
    !Array.isArray(value.amount)
  ) {
    throw new Error("Malformed Blockfrost UTxO");
  }
  return {
    address: value.address,
    tx_hash: value.tx_hash,
    output_index: value.output_index,
    amount: value.amount.map(parseQuantity),
  };
}

const parseUtxos = (value: unknown): UTxO[] => {
  if (!Array.isArray(value)) throw new Error("Malformed UTxO list");
  return value.map(parseUtxo);
};

const parseAddressList = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("Malformed address list");
  }
  return value as string[];
};

async function fetchUtxosForAddress(mainnet: boolean, address: string): Promise<UTxO[]> {
  return parseUtxos(await fetchAllPages(mainnet, `/api/v0/addresses/${address}/utxos`));
}

/** Every address of the account's stake key (all pages). */
async function fetchAccountAddresses(mainnet: boolean, stakeKey: string): Promise<string[]> {
  const items = await fetchAllPages(mainnet, `/api/v0/accounts/${stakeKey}/addresses`);
  return items.map((item) => {
    if (!isRecord(item) || typeof item.address !== "string") {
      throw new Error("Malformed Blockfrost account address");
    }
    return item.address;
  });
}

/**
 * The chain scope of an impersonated address: its stake account when it has one, otherwise
 * (enterprise/pointer addresses) the single address itself.
 */
function accountScope(address: string): { mainnet: boolean; stakeKey: string | null } {
  const network = networkIdFromAddress(address);
  if (network === null) throw new Error(`Cannot determine the network of ${address}`);
  return { mainnet: network === 1, stakeKey: stakeKeyFromAddress(address) };
}

async function loadUsedAddresses(address: string): Promise<string[]> {
  const { mainnet, stakeKey } = accountScope(address);
  return stakeKey === null ? [address] : fetchAccountAddresses(mainnet, stakeKey);
}

async function loadUtxos(address: string): Promise<UTxO[]> {
  const { mainnet, stakeKey } = accountScope(address);
  if (stakeKey === null) return fetchUtxosForAddress(mainnet, address);
  const addresses = await fetchAccountAddresses(mainnet, stakeKey);
  const perAddress = await Promise.all(addresses.map((a) => fetchUtxosForAddress(mainnet, a)));
  return perAddress.flat();
}

// --- Cache with TTL ---

const CACHE_TTL_MS = 30_000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const isFresh = (entry: CacheEntry<unknown>, now = Date.now()) => now - entry.timestamp <= CACHE_TTL_MS;

/**
 * TTL cache keyed by impersonated address. Only successful loads are stored, concurrent
 * loads of one key share a promise, and a load that was invalidated while in flight is
 * not stored.
 */
class AddressCache<T> {
  readonly entries = new Map<string, CacheEntry<T>>();
  private inFlight = new Map<string, Promise<T>>();
  private generation = 0;

  constructor(private readonly onStored: () => Promise<void>) {}

  async get(address: string, load: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(address);
    if (entry && isFresh(entry)) return entry.data;
    this.entries.delete(address);

    const pending = this.inFlight.get(address);
    if (pending) return pending;

    const generation = this.generation;
    const promise = (async () => {
      const data = await load();
      if (generation === this.generation) {
        this.entries.set(address, { data, timestamp: Date.now() });
        await this.onStored();
      }
      return data;
    })().finally(() => {
      if (this.inFlight.get(address) === promise) this.inFlight.delete(address);
    });
    this.inFlight.set(address, promise);
    return promise;
  }

  delete(address: string): void {
    this.entries.delete(address);
    this.inFlight.delete(address);
    this.generation++;
  }
}

// --- Session storage persistence (survives service-worker idle restarts) ---

const SESSION_CACHE_KEY = "sorbet_blockfrost_cache";
const persistQueue = createSerialQueue();

const freshEntries = <T>(cache: AddressCache<T>): Record<string, CacheEntry<T>> => {
  const now = Date.now();
  for (const [address, entry] of cache.entries) {
    if (!isFresh(entry, now)) cache.entries.delete(address);
  }
  return Object.fromEntries(cache.entries);
};

/** Persist the caches. Serialized so snapshots reach storage in order; best effort. */
function persistCaches(): Promise<void> {
  return persistQueue(async () => {
    try {
      await storageSet("session", {
        [SESSION_CACHE_KEY]: {
          usedAddresses: freshEntries(usedAddressesCache),
          utxos: freshEntries(utxosCache),
        },
      });
    } catch (err) {
      Log.W("Sorbet: could not persist the Blockfrost cache", err);
    }
  });
}

const usedAddressesCache = new AddressCache<string[]>(persistCaches);
const utxosCache = new AddressCache<UTxO[]>(persistCaches);

function restoreEntries<T>(
  cache: AddressCache<T>,
  saved: unknown,
  parse: (data: unknown) => T
): void {
  if (!isRecord(saved)) return;
  for (const [address, entry] of Object.entries(saved)) {
    if (!isRecord(entry) || typeof entry.timestamp !== "number") continue;
    const restored = { data: parse(entry.data), timestamp: entry.timestamp };
    if (isFresh(restored)) cache.entries.set(address, restored);
  }
}

async function restoreCaches(): Promise<void> {
  try {
    const saved = (await storageGet("session", [SESSION_CACHE_KEY]))[SESSION_CACHE_KEY];
    if (!isRecord(saved)) return;
    restoreEntries(usedAddressesCache, saved.usedAddresses, parseAddressList);
    restoreEntries(utxosCache, saved.utxos, parseUtxos);
  } catch (err) {
    Log.W("Sorbet: could not restore the Blockfrost cache", err);
  }
}

/** Every request awaits this, so no request reads or writes the caches before the restore. */
const cachesRestored = restoreCaches();

function clearCachesForAddress(address: string): Promise<void> {
  usedAddressesCache.delete(address);
  utxosCache.delete(address);
  return persistCaches();
}

// --- Request handling ---

const NO_ADDRESS_ERROR = "No impersonated address set";

function paginateItems<T>(items: T[], paginate: TPaginate | undefined): T[] {
  if (!paginate) return items;
  const { page, limit } = paginate;
  if (!Number.isInteger(page) || page < 0 || !Number.isInteger(limit) || limit < 1) {
    throw new Error(`Invalid pagination: page ${page}, limit ${limit}`);
  }
  return items.slice(page * limit, (page + 1) * limit);
}

async function requireImpersonatedAddress(): Promise<string> {
  const { impersonatedAddress } = await loadSettings(["impersonatedAddress"]);
  if (!impersonatedAddress) throw new Error(NO_ADDRESS_ERROR);
  return impersonatedAddress;
}

function requireValidAddress(address: string): void {
  if (!isValidAddress(address)) throw new Error(`Invalid address: ${address}`);
}

/** Who sent a request, from the browser-provided MessageSender (pages cannot forge it). */
type Caller = { kind: "extension" } | { kind: "web"; origin: string | null };

/** D1: an extension page has our extension origin; everything else is a web page. */
function classifySender(sender: chrome.runtime.MessageSender): Caller {
  const extensionOrigin = `chrome-extension://${chrome.runtime.id}`;
  if (sender.origin === extensionOrigin || sender.url?.startsWith(extensionOrigin + "/")) {
    return { kind: "extension" };
  }
  return { kind: "web", origin: siteOrigin(sender.origin ?? sender.url) };
}

async function setImpersonatedAddress(address: string): Promise<{ address: string }> {
  requireValidAddress(address);
  const { impersonatedAddress: previous } = await loadSettings(["impersonatedAddress"]);
  if (previous === address) return { address };
  await saveSettings({ impersonatedAddress: address });
  if (previous) await clearCachesForAddress(previous);
  return { address };
}

/**
 * Performs a request that is already authorized. `origin` is the site origin of a web page
 * caller, or undefined for an extension page (or a request that needs no origin).
 */
async function handleRequest(
  request: AnyBackgroundRequest,
  origin: string | undefined
): Promise<BackgroundResponseData[BackgroundAction]> {
  Log.App.Message("handleRequest", request);
  await cachesRestored;
  switch (request.action) {
    case BackgroundAction.PING:
    case BackgroundAction.REQUEST_CONNECT:
      return null;
    case BackgroundAction.IS_CONNECTED:
      return true;
    case BackgroundAction.ADD_TO_ADDRESS_BOOK:
    case BackgroundAction.CONTEXT_MENU_ADD_TO_ADDRESS_BOOK: {
      requireValidAddress(request.address);
      await addAddress(request.address);
      return { address: request.address };
    }
    case BackgroundAction.SET_ADDRESS:
    case BackgroundAction.CONTEXT_MENU_SET_ADDRESS:
      return setImpersonatedAddress(request.address);
    case BackgroundAction.QUERY_INJECTION_CONFIG:
      return loadSettings(WALLET_INJECTION_KEYS);
    case BackgroundAction.APPROVAL_GET:
      return getApproval(request.approvalId);
    case BackgroundAction.APPROVAL_DECIDE:
      decideApproval(request.approvalId, request.decision);
      return null;
    case BackgroundAction.STORE_WALLET_LOG: {
      // The origin comes from the sender, never from the page-supplied payload.
      await appendWalletLog({ ...request.payload, origin });
      return null;
    }
    case BackgroundAction.QUERY_WALLET_CONFIG: {
      const { impersonatedAddress } = await loadSettings(["impersonatedAddress"]);
      const reply: WalletConfigReply = {
        impersonatedAddress,
        network: impersonatedAddress ? networkIdFromAddress(impersonatedAddress) : null,
      };
      return reply;
    }
    case BackgroundAction.GET_USED_ADDRESSES: {
      const address = await requireImpersonatedAddress();
      const addresses = await usedAddressesCache.get(address, () => loadUsedAddresses(address));
      return paginateItems(addresses, request.paginate);
    }
    case BackgroundAction.GET_COLLATERAL:
      return null;
    case BackgroundAction.GET_BALANCE: {
      const settings = await loadSettings(["impersonatedAddress", "customResponseEnabled", "mockUtxos"]);
      if (!settings.impersonatedAddress) throw new Error(NO_ADDRESS_ERROR);
      if (settings.customResponseEnabled) {
        Log.D("returning custom response from getBalance()", { mockUtxos: settings.mockUtxos });
        return computeBalanceFromAmounts(settings.mockUtxos);
      }
      const address = settings.impersonatedAddress;
      return computeBalanceFromAmounts(await utxosCache.get(address, () => loadUtxos(address)));
    }
    case BackgroundAction.GET_UTXOS: {
      const settings = await loadSettings(["impersonatedAddress", "customResponseEnabled", "mockUtxos"]);
      if (!settings.impersonatedAddress) throw new Error(NO_ADDRESS_ERROR);
      if (settings.customResponseEnabled) {
        Log.D("Returning custom UTxO response", settings.mockUtxos);
        return encodeUtxos(paginateItems(settings.mockUtxos, request.paginate));
      }
      const address = settings.impersonatedAddress;
      const utxos = await utxosCache.get(address, () => loadUtxos(address));
      return encodeUtxos(paginateItems(utxos, request.paginate));
    }
  }
}

function requireSiteOrigin(origin: string | null): string {
  if (origin === null) throw new RefusedError("Requests from this page are not allowed");
  return origin;
}

async function requireConnected(origin: string | null): Promise<string> {
  const site = requireSiteOrigin(origin);
  if (!(await getSitePermission(site)).connect) throw new RefusedError(`${site} is not connected to Sorbet`);
  return site;
}

/** setAddress / addToAddressBook from a web page: stored permission, else one approval. */
async function authorizeHook(origin: string | null, kind: ApprovalKind, address: string): Promise<void> {
  const site = requireSiteOrigin(origin);
  requireValidAddress(address);
  if ((await getSitePermission(site)).hooks) return;
  const decision = await requestApproval(site, kind, address);
  if (decision === "deny") throw new RefusedError(`The request from ${site} was denied`);
  if (decision === "allow_always") await grantSitePermission(site, "hooks");
}

/**
 * The single permission gate (D1/D2): extension pages are never gated; web pages pass only
 * the rules below. Every request is authorized here before handleRequest performs it.
 */
async function dispatch(
  request: AnyBackgroundRequest,
  caller: Caller
): Promise<BackgroundResponseData[BackgroundAction]> {
  if (caller.kind === "extension") return handleRequest(request, undefined);
  const { origin } = caller;
  switch (request.action) {
    case BackgroundAction.PING:
    case BackgroundAction.QUERY_INJECTION_CONFIG:
    case BackgroundAction.CONTEXT_MENU_SET_ADDRESS:
    case BackgroundAction.CONTEXT_MENU_ADD_TO_ADDRESS_BOOK:
      return handleRequest(request, undefined);
    case BackgroundAction.IS_CONNECTED:
      return origin !== null && (await getSitePermission(origin)).connect;
    case BackgroundAction.REQUEST_CONNECT: {
      const site = requireSiteOrigin(origin);
      if ((await getSitePermission(site)).connect) return null;
      const decision = await requestApproval(site, "connect");
      if (decision !== "allow_always") throw new RefusedError(`The connection request from ${site} was denied`);
      await grantSitePermission(site, "connect");
      return null;
    }
    case BackgroundAction.QUERY_WALLET_CONFIG:
    case BackgroundAction.GET_USED_ADDRESSES:
    case BackgroundAction.GET_COLLATERAL:
    case BackgroundAction.GET_BALANCE:
    case BackgroundAction.GET_UTXOS:
    case BackgroundAction.STORE_WALLET_LOG:
      return handleRequest(request, await requireConnected(origin));
    case BackgroundAction.SET_ADDRESS:
      await authorizeHook(origin, "setAddress", request.address);
      return handleRequest(request, undefined);
    case BackgroundAction.ADD_TO_ADDRESS_BOOK:
      await authorizeHook(origin, "addToAddressBook", request.address);
      return handleRequest(request, undefined);
    case BackgroundAction.APPROVAL_GET:
    case BackgroundAction.APPROVAL_DECIDE:
      throw new RefusedError("Approvals can only be answered from Sorbet");
  }
}

async function reply(request: AnyBackgroundRequest, sender: chrome.runtime.MessageSender): Promise<BackgroundReply> {
  try {
    return { id: request.id, ok: true, data: await dispatch(request, classifySender(sender)) };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (err instanceof RefusedError) return { id: request.id, ok: false, error, refused: true };
    console.error("Sorbet: background request failed:", err);
    return { id: request.id, ok: false, error };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Anything else (e.g. p2p_popup_exists) is answered by another context.
  if (!isBackgroundRequest(message)) return false;
  void reply(message, sender).then(sendResponse);
  return true;
});

// D5: content scripts must not read storage (Blockfrost keys, P2P seeds).
for (const area of ["sync", "local"] as const) {
  chrome.storage[area].setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }).catch((err: unknown) => {
    Log.W(`Sorbet: could not restrict chrome.storage.${area} to trusted contexts`, err);
  });
}
