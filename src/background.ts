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

// --- In-flight deduplication ---
const inFlightRequests: Record<string, Promise<any>> = {};

async function getRawUtxos(mainnet: boolean, stakeKey: string, cacheKey: string): Promise<any[]> {
  const cached = getCached(blockfrostCache.rawUtxos[cacheKey]);
  if (cached) return cached;

  const flightKey = `rawUtxos:${cacheKey}`;
  if (flightKey in inFlightRequests) return inFlightRequests[flightKey];

  const promise = getAllUtxos(mainnet, stakeKey).then((utxos) => {
    blockfrostCache.rawUtxos[cacheKey] = setCache(utxos);
    delete inFlightRequests[flightKey];
    return utxos;
  }).catch((err) => {
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
  const { blockfrostApiKey, blockfrostMainnetApiKey, blockfrostPreviewApiKey } =
    await getFromStorage({
      blockfrostApiKey: undefined,
      blockfrostMainnetApiKey: "",
      blockfrostPreviewApiKey: "",
    });

  const blockfrostUrl = mainnet
    ? "https://cardano-mainnet.blockfrost.io"
    : "https://cardano-preview.blockfrost.io";
  const requestUrl = new URL(path, blockfrostUrl);
  for (const [key, value] of Object.entries(params)) {
    requestUrl.searchParams.append(key, value);
  }

  const headers: Record<string, string> = {};
  headers.project_id = mainnet
    ? blockfrostApiKey ?? blockfrostMainnetApiKey
    : blockfrostPreviewApiKey;

  const res = await fetch(requestUrl, { method: "GET", headers });

  if (res.status === 429 || res.status === 409) {
    if (retryCount >= MAX_RETRIES) {
      throw new Error(`Blockfrost rate limit exceeded after ${MAX_RETRIES} retries for ${path}`);
    }
    const delay = Math.min(200 * Math.pow(2, retryCount), 5000);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return callBlockfrost(mainnet, path, params, retryCount + 1);
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
        if (addressBook.find((abe) => abe.address === address)) return;
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
      const { impersonatedAddress: oldAddress } = await getFromStorage({
        impersonatedAddress: "",
      });
      if (oldAddress && oldAddress !== address) {
        clearCacheForAddress(oldAddress);
      }
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
      const { walletType, impersonatedAddress, wrapWallet } = await getFromStorage([
        "wrapWallet",
        "impersonatedAddress",
        "walletType",
      ]);
      const network = impersonatedAddress?.startsWith("addr_test") ? 0 : 1;
      return {
        walletType: walletType ?? EWalletType.IMPERSONATE,
        wrapWallet,
        impersonatedAddress,
        network,
      };
    }
    case "request_getUsedAddresses": {
      const { impersonatedAddress } = await getFromStorage({
        impersonatedAddress: "",
      });
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
      const addresses = addrs?.map(({ address }: { address: string }) => {
        return address;
      });
      blockfrostCache.usedAddresses[impersonatedAddress] = setCache(addresses);
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

async function getUtxosForAddress(mainnet: boolean, address: string): Promise<any[]> {
  const utxos: any[] = [];
  let page = 1;
  while (true) {
    const pageData = await callBlockfrost(
      mainnet,
      `/api/v0/addresses/${address}/utxos?page=${page}`,
    );
    if (!pageData || pageData.length === 0) {
      break;
    }
    utxos.push(...pageData);
    page += 1;
  }
  return utxos;
}

async function getAllUtxos(mainnet: boolean, stakeKey: string): Promise<any[]> {
  const addresses = await callBlockfrost<{ address: string }[]>(
    mainnet,
    `/api/v0/accounts/${stakeKey}/addresses`,
  );

  if (!addresses?.length) {
    return [];
  }

  const results = await Promise.all(
    addresses.map(({ address }) => getUtxosForAddress(mainnet, address)),
  );
  return results.flat();
}
