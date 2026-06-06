import { STORE_WALLET_LOG_ACTION } from "./modules/walletLog";
import { processWalletLogRequest } from "./modules/walletLogStorageHandler";
import { EWalletType } from "./types";
import { stakeKeyFromAddress } from "./utils/addresses";
import { assetsToEncodedBalance, computeBalanceFromAmounts } from "./utils/balance";
import { Log } from "./utils/log_util";
import { CustomResponseStorageKeys, getFromStorage } from "./utils/storage";
import { MultiAssetAmount, encodeUtxos } from "./utils/utxo";

interface Asset {
  unit: string;
  amount: string;
}

export interface Quantity {
  unit: string;
  quantity: string;
}

// --- In-memory config caches (populated on first use, invalidated via onChanged) ---
let cachedBlockfrostKeys: {
  blockfrostApiKey: string | undefined;
  blockfrostMainnetApiKey: string;
  blockfrostPreviewApiKey: string;
} | null = null;

let cachedWalletConfig: {
  walletType: string;
  impersonatedAddress: string;
  wrapWallet: string;
} | null = null;

async function getBlockfrostKeys() {
  if (cachedBlockfrostKeys) return cachedBlockfrostKeys;
  const keys = await getFromStorage({
    blockfrostApiKey: undefined,
    blockfrostMainnetApiKey: "",
    blockfrostPreviewApiKey: "",
  });
  cachedBlockfrostKeys = {
    blockfrostApiKey: keys.blockfrostApiKey,
    blockfrostMainnetApiKey: keys.blockfrostMainnetApiKey,
    blockfrostPreviewApiKey: keys.blockfrostPreviewApiKey,
  };
  return cachedBlockfrostKeys;
}

async function getWalletConfig() {
  if (cachedWalletConfig) return cachedWalletConfig;
  const { walletType, impersonatedAddress, wrapWallet } = await getFromStorage([
    "wrapWallet",
    "impersonatedAddress",
    "walletType",
  ]);
  cachedWalletConfig = {
    walletType: walletType ?? EWalletType.IMPERSONATE,
    impersonatedAddress: impersonatedAddress ?? "",
    wrapWallet: wrapWallet ?? "",
  };
  return cachedWalletConfig;
}

// Invalidate in-memory caches when storage changes.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (
    "blockfrostApiKey" in changes ||
    "blockfrostMainnetApiKey" in changes ||
    "blockfrostPreviewApiKey" in changes
  ) {
    cachedBlockfrostKeys = null;
  }
  if ("walletType" in changes || "impersonatedAddress" in changes || "wrapWallet" in changes) {
    cachedWalletConfig = null;
  }
});

// --- Cache with TTL ---
const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getCached<T>(entry: CacheEntry<T> | undefined): T | null {
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
  return entry.data;
}

function setCache<T>(data: T): CacheEntry<T> {
  return { data, timestamp: Date.now() };
}

const blockfrostCache: {
  usedAddresses: Record<string, CacheEntry<string[]>>;
  rawUtxos: Record<string, CacheEntry<any[]>>;
  balance: Record<string, CacheEntry<any>>;
  utxos: Record<string, CacheEntry<any[]>>;
} = {
  usedAddresses: {},
  rawUtxos: {},
  balance: {},
  utxos: {},
};

function clearCacheForAddress(address: string) {
  delete blockfrostCache.usedAddresses[address];
  delete blockfrostCache.rawUtxos[address];
  delete blockfrostCache.balance[address];
  delete blockfrostCache.utxos[address];
}

// --- Session storage persistence (survives SW idle restarts) ---
const SESSION_CACHE_KEY = "sorbet_blockfrost_cache";

async function persistCacheToSession() {
  try {
    await chrome.storage.session.set({ [SESSION_CACHE_KEY]: blockfrostCache });
  } catch {
    // session storage may not be available in all contexts
  }
}

async function restoreCacheFromSession() {
  try {
    const result = await chrome.storage.session.get(SESSION_CACHE_KEY);
    const saved = result[SESSION_CACHE_KEY];
    if (saved) {
      Object.assign(blockfrostCache.usedAddresses, saved.usedAddresses);
      Object.assign(blockfrostCache.rawUtxos, saved.rawUtxos);
      Object.assign(blockfrostCache.balance, saved.balance);
      Object.assign(blockfrostCache.utxos, saved.utxos);
    }
  } catch {
    // session storage may not be available
  }
}

// Restore cache on SW startup.
restoreCacheFromSession();

// --- In-flight deduplication ---
const inFlightRequests: Record<string, Promise<any>> = {};

async function getRawUtxos(mainnet: boolean, stakeKey: string, cacheKey: string): Promise<any[]> {
  const cached = getCached(blockfrostCache.rawUtxos[cacheKey]);
  if (cached) return cached;

  const flightKey = `rawUtxos:${cacheKey}`;
  if (flightKey in inFlightRequests) return inFlightRequests[flightKey];

  const promise = getAllUtxos(mainnet, stakeKey)
    .then((utxos) => {
      blockfrostCache.rawUtxos[cacheKey] = setCache(utxos);
      delete inFlightRequests[flightKey];
      persistCacheToSession();
      return utxos;
    })
    .catch((err) => {
      delete inFlightRequests[flightKey];
      throw err;
    });

  inFlightRequests[flightKey] = promise;
  return promise;
}

// --- Message listener ---
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    try {
      // Fast path: ping is used to pre-warm the service worker.
      if (request.action === "ping") {
        sendResponse({ ok: true });
        return;
      }
      const response = await handleRequest(request);
      if (response) {
        response.id = request.id;
        sendResponse(response);
      }
    } catch (err) {
      console.error("Sorbet: background handleRequest error:", err);
      sendResponse({ id: request.id, error: String(err) });
    }
  })();
  return true;
});

// --- Blockfrost API with exponential backoff ---
const MAX_RETRIES = 5;

async function callBlockfrost<R = any>(
  mainnet: Boolean,
  path: string,
  params: Record<string, string> = {},
  retryCount: number = 0
): Promise<R> {
  const keys = await getBlockfrostKeys();

  const blockfrostUrl = mainnet
    ? "https://cardano-mainnet.blockfrost.io"
    : "https://cardano-preview.blockfrost.io";
  const requestUrl = new URL(path, blockfrostUrl);
  for (const [key, value] of Object.entries(params)) {
    requestUrl.searchParams.append(key, value);
  }

  const headers: Record<string, string> = {};
  headers.project_id = mainnet
    ? keys.blockfrostApiKey ?? keys.blockfrostMainnetApiKey
    : keys.blockfrostPreviewApiKey;

  const res = await fetch(requestUrl, { method: "GET", headers });

  if (res.status === 429 || res.status === 409) {
    if (retryCount >= MAX_RETRIES) {
      throw new Error(`Blockfrost rate limit exceeded after ${MAX_RETRIES} retries for ${path}`);
    }
    const delay = Math.min(200 * Math.pow(2, retryCount), 5000);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return callBlockfrost(mainnet, path, params, retryCount + 1);
  }

  // 404 on an address/account endpoint means "never seen on-chain" — a genuine
  // empty, NOT a failure. Return null so callers can treat it as empty without
  // conflating it with a transient error. Transient errors must keep throwing
  // (below) so they propagate and get retried, rather than silently becoming a
  // zero balance that then poisons the 30s cache.
  if (res.status === 404) {
    return null as R;
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(`Sorbet: Blockfrost ${res.status} for ${path}:`, body);
    throw new Error(`Blockfrost API error ${res.status}: ${body}`);
  }

  return res.json();
}

// --- Request handler ---
async function handleRequest(request: any) {
  Log.App.Message("handleRequest", request);
  switch (request.action) {
    case "p2p_popup_exists": {
      return false;
    }
    case "addToAddressBook": {
      console.log("Sorbet: adding to address book");
      const { address } = request;
      chrome.storage.sync.get(["addressBook"], function (result) {
        const addressBook =
          result.addressBook && Array.isArray(result.addressBook) ? result.addressBook : [];
        if (addressBook.find((abe: any) => abe.address === address)) return;
        const newAddressBook = [...addressBook, { address }];
        chrome.storage.sync.set({ addressBook: newAddressBook }, function () {
          console.log("Sorbet: address added to address book:", address);
        });
      });
      return { address };
    }
    case "setAddress": {
      const { address } = request;
      // Clear stale cache when address changes
      const config = await getWalletConfig();
      if (config.impersonatedAddress && config.impersonatedAddress !== address) {
        clearCacheForAddress(config.impersonatedAddress);
      }
      // Invalidate the in-memory wallet config so the next read picks up the new address.
      cachedWalletConfig = null;
      chrome.storage.sync.set({ impersonatedAddress: address }, function () {
        console.log("Sorbet: wallet address updated:", address);
      });
      return { address };
    }
    case STORE_WALLET_LOG_ACTION: {
      return processWalletLogRequest(request);
    }
    case "query_shouldScanForAddresses": {
      const { shouldScanForAddresses } = await getFromStorage(["shouldScanForAddresses"]);
      return { shouldScanForAddresses };
    }
    case "query_walletConfig": {
      const config = await getWalletConfig();
      const network = config.impersonatedAddress?.startsWith("addr_test") ? 0 : 1;
      return {
        walletType: config.walletType,
        wrapWallet: config.wrapWallet,
        impersonatedAddress: config.impersonatedAddress,
        network,
      };
    }
    case "request_getUsedAddresses": {
      const config = await getWalletConfig();
      const impersonatedAddress = config.impersonatedAddress;
      if (!impersonatedAddress) {
        return { error: "No impersonated address set" };
      }

      const cached = getCached(blockfrostCache.usedAddresses[impersonatedAddress]);
      if (cached) {
        return { addresses: cached };
      }

      const stakeKey = stakeKeyFromAddress(impersonatedAddress);
      const addrs = await callBlockfrost(
        !impersonatedAddress?.startsWith("addr_test"),
        `/api/v0/accounts/${stakeKey}/addresses`,
        {
          count: (request?.paginate?.limit ?? 100).toString(),
          page: (request?.paginate?.page ?? 1).toString(),
        }
      );
      const addresses =
        addrs?.map(({ address }: { address: string }) => {
          return address;
        }) ?? [];
      blockfrostCache.usedAddresses[impersonatedAddress] = setCache(addresses);
      persistCacheToSession();
      return {
        id: request.id,
        addresses,
      };
    }
    case "request_getCollateral": {
      return {
        collateral: null,
      };
    }
    case "request_getBalance": {
      const storage = await getFromStorage({
        impersonatedAddress: "",
        [CustomResponseStorageKeys.CUSTOM_RESPONSE_ENABLED]: false,
        [CustomResponseStorageKeys.MOCK_UTXOS]: [],
      });
      const { impersonatedAddress } = storage;
      const isCustomResponseEnabled = storage[CustomResponseStorageKeys.CUSTOM_RESPONSE_ENABLED];
      const mockUtxos = storage[CustomResponseStorageKeys.MOCK_UTXOS];

      if (!impersonatedAddress) {
        return { error: "No impersonated address set" };
      }

      let utxos: { amount: Quantity[] }[];
      if (isCustomResponseEnabled) {
        utxos = mockUtxos;
        Log.D("returning custom response from getBalance()", { mockUtxos });
      } else {
        const cachedBalance = getCached(blockfrostCache.balance[impersonatedAddress]);
        if (cachedBalance) {
          return { balance: cachedBalance };
        }

        const mainnet = !impersonatedAddress?.startsWith("addr_test");
        const stakeKey = stakeKeyFromAddress(impersonatedAddress);
        utxos = await getRawUtxos(mainnet, stakeKey, impersonatedAddress);
      }

      const balance = computeBalanceFromAmounts(utxos);
      if (!isCustomResponseEnabled) {
        blockfrostCache.balance[impersonatedAddress] = setCache(balance);
        persistCacheToSession();
      }
      return {
        balance,
      };
    }

    case "request_getUTXOs": {
      const storage = await getFromStorage({
        impersonatedAddress: "",
        [CustomResponseStorageKeys.CUSTOM_RESPONSE_ENABLED]: false,
        [CustomResponseStorageKeys.MOCK_UTXOS]: [],
      });
      const { impersonatedAddress } = storage;
      const isCustomResponseEnabled = storage[CustomResponseStorageKeys.CUSTOM_RESPONSE_ENABLED];
      const mockUtxos = storage[CustomResponseStorageKeys.MOCK_UTXOS];
      if (!impersonatedAddress) {
        return { error: "No impersonated address set" };
      }
      if (isCustomResponseEnabled) {
        Log.D("Returning custom UTxO response", mockUtxos);
        return {
          utxos: encodeUtxos(mockUtxos),
        };
      }

      const cachedUtxos = getCached(blockfrostCache.utxos[impersonatedAddress]);
      if (cachedUtxos) {
        return { utxos: cachedUtxos };
      }

      const mainnet = !impersonatedAddress?.startsWith("addr_test");
      const stakeKey = stakeKeyFromAddress(impersonatedAddress);

      const rawUtxos = await getRawUtxos(mainnet, stakeKey, impersonatedAddress);
      const utxos = rawUtxos.flat();
      const utxosWithAssets = encodeUtxos(utxos);

      blockfrostCache.utxos[impersonatedAddress] = setCache(utxosWithAssets);
      persistCacheToSession();
      return {
        utxos: utxosWithAssets,
      };
    }
    default:
      return { error: `Unrecognized action ${request.action}` };
  }
}

export interface AddressInfo {
  address: string;
  stake_address: string;
  amount: Quantity[];
  type: string;
  script: boolean;
}

// Blockfrost returns 100 items per page by default.
const BLOCKFROST_PAGE_SIZE = 100;
const PARALLEL_PAGES = 3;

async function getUtxosForAddress(mainnet: boolean, address: string): Promise<any[]> {
  const utxos: any[] = [];
  let page = 1;

  // Speculative parallel fetch: request PARALLEL_PAGES pages at once.
  // NOTE: we deliberately do NOT swallow page errors. callBlockfrost returns
  // null for a 404 (a genuine empty page, past the last page or an unused
  // address); any other failure (429 after retries, 5xx, network) throws and
  // must propagate so the caller can retry — silently coercing it to [] here
  // would undercount or zero the balance and then cache that wrong result.
  while (true) {
    const pageNumbers = Array.from({ length: PARALLEL_PAGES }, (_, i) => page + i);
    const pageResults = await Promise.all(
      pageNumbers.map((p) =>
        callBlockfrost<any[] | null>(mainnet, `/api/v0/addresses/${address}/utxos`, {
          page: p.toString(),
        })
      )
    );

    let lastNonEmpty = -1;
    for (let i = 0; i < pageResults.length; i++) {
      const data = pageResults[i];
      if (data && data.length > 0) {
        utxos.push(...data);
        lastNonEmpty = i;
      }
    }

    // If no pages returned data, or the last non-empty page was not full, we're done.
    if (lastNonEmpty === -1) break;
    const lastPage = pageResults[lastNonEmpty];
    if (!lastPage || lastPage.length < BLOCKFROST_PAGE_SIZE) break;

    page += PARALLEL_PAGES;
  }
  return utxos;
}

async function getAllUtxos(mainnet: boolean, stakeKey: string): Promise<any[]> {
  const addresses = await callBlockfrost<{ address: string }[]>(
    mainnet,
    `/api/v0/accounts/${stakeKey}/addresses`
  );

  if (!addresses?.length) {
    return [];
  }

  const results = await Promise.all(
    addresses.map(({ address }) => getUtxosForAddress(mainnet, address))
  );
  return results.flat();
}
