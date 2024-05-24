import { STORE_WALLET_LOG_ACTION } from "./modules/walletLog";
import { processWalletLogRequest } from "./modules/walletLogStorageHandler";
import { EWalletType } from "./types";
import { stakeKeyFromAddress } from "./utils/addresses";
import { computeBalanceFromQuantities } from "./utils/balance";
import { Log } from "./utils/log_util";
import { CustomResponseStorageKeys, getFromStorage } from "./utils/storage";
import { encodeUtxos } from "./utils/utxo";

interface Asset {
  unit: string;
  amount: string;
}

export interface Quantity {
  unit: string;
  quantity: string;
}

const blockfrostCache: any = {
  usedAddresses: {},
  balance: {},
  utxos: {},
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    const response = await handleRequest(request);
    response.id = request.id;
    sendResponse(response);
  })();
  return true;
});

let rateLimiter = Promise.resolve();

async function callBlockfrost<R = any>(mainnet: Boolean, path: string, params: Record<string, string> = {}): Promise<R> {
  await rateLimiter;

  const { blockfrostApiKey, blockfrostMainnetApiKey, blockfrostPreviewApiKey } = await getFromStorage({
    blockfrostApiKey: undefined,
    blockfrostMainnetApiKey: "",
    blockfrostPreviewApiKey: "",
  });

  const blockfrostUrl = mainnet
    ? "https://cardano-mainnet.blockfrost.io"
    : "https://cardano-preview.blockfrost.io";
  const usedAddressesUrl = new URL(path, blockfrostUrl);
  for (const [key, value] of Object.entries(params)) {
    usedAddressesUrl.searchParams.append(key, value);
  }

  const headers: Record<string, string> = {};
  headers.project_id = mainnet ? (blockfrostApiKey ?? blockfrostMainnetApiKey) : blockfrostPreviewApiKey;

  const fetchParams = {
    method: "GET",
    headers,
  };

  const res = await fetch(usedAddressesUrl, fetchParams);

  if (res.status === 409) {
    rateLimiter = new Promise((resolve) => {
      setTimeout(resolve, 1000 / 10);
    });
    return callBlockfrost(mainnet, path, params);
  } else {
    return res.json();
  }
}

async function handleRequest(request: any) {
  switch (request.action) {
    case "addToAddressBook": {
      console.log("Sorbet: adding to address book")
      const { address } = request
      chrome.storage.sync.get(
        ["addressBook"],
        function (result) {
          const addressBook = result.addressBook && Array.isArray(result.addressBook) ? result.addressBook : []
          if (addressBook.find(abe => abe.address === address))
            return
          const newAddressBook = [...addressBook, { address }];
          chrome.storage.sync.set({ addressBook: newAddressBook }, function () {
            console.log("Sorbet: address added to address book:", address)
          });
        })
      return { address }
    }
    case "setAddress": {
      const { address } = request
      chrome.storage.sync.set({ impersonatedAddress: address }, function () {
        console.log("Sorbet: wallet address updated:", address)
      });
      return { address }
    }
    case STORE_WALLET_LOG_ACTION: {
      return processWalletLogRequest(request)
    }
    case "query_shouldScanForAddresses": {
      const { shouldScanForAddresses } = await getFromStorage([
        "shouldScanForAddresses",
      ]);
      return { shouldScanForAddresses };
    }
    case "query_walletConfig": {
      const { walletType, impersonatedAddress, wallet } = await getFromStorage([
        "wallet",
        "impersonatedAddress",
        "walletType",
      ]);
      const network = impersonatedAddress?.startsWith("addr_test") ? 0 : 1;
      return {
        walletType: walletType ?? EWalletType.IMPERSONATE,
        wallet,
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
      if (blockfrostCache.usedAddresses[impersonatedAddress]) {
        return { addresses: blockfrostCache.usedAddresses[impersonatedAddress] };
      }

      const stakeKey = stakeKeyFromAddress(impersonatedAddress);
      const addrs = await callBlockfrost(!impersonatedAddress?.startsWith("addr_test"), `/api/v0/accounts/${stakeKey}/addresses`, {
        count: (request?.paginate?.limit ?? 100).toString(),
        page: (request?.paginate?.page ?? 1).toString(),
      });
      const addresses = addrs?.map(({ address }: { address: string }) => {
        return address;
      });
      blockfrostCache.usedAddresses[impersonatedAddress] = addresses;
      return {
        id: request.id,
        addresses,
      };
    }
    case "request_getBalance": {
      const storage = await getFromStorage({
        impersonatedAddress: "",
        [CustomResponseStorageKeys.CUSTOM_RESPONSE_ENABLED]: false,
        [CustomResponseStorageKeys.MOCK_UTXOS]: [],
      });
      const { impersonatedAddress } = storage
      const isCustomResponseEnabled = storage[CustomResponseStorageKeys.CUSTOM_RESPONSE_ENABLED]
      const mockUtxos = storage[CustomResponseStorageKeys.MOCK_UTXOS]

      if (!impersonatedAddress) {
        return { error: "No impersonated address set" };
      }

      let addressInfos: { amount: Quantity[] }[]
      if (isCustomResponseEnabled) {
        addressInfos = mockUtxos
        Log.D("returning custom response from getBalance()", { mockUtxos })
      } else if (blockfrostCache.balance[impersonatedAddress]) {
        return { balance: blockfrostCache.balance[impersonatedAddress] };
      } else {
        const mainnet = !impersonatedAddress?.startsWith("addr_test")
        const stakeKey = stakeKeyFromAddress(impersonatedAddress);
        addressInfos = await getAddressInfo(mainnet, stakeKey)
      }
      const balance = computeBalanceFromQuantities(addressInfos);
      if (!isCustomResponseEnabled) {
        blockfrostCache.balance[impersonatedAddress] = balance;
      }
      return {
        balance
      }
    }

    case "request_getUTXOs": {
      const storage = await getFromStorage({
        impersonatedAddress: "",
        [CustomResponseStorageKeys.CUSTOM_RESPONSE_ENABLED]: false,
        [CustomResponseStorageKeys.MOCK_UTXOS]: [],
      });
      const { impersonatedAddress } = storage
      const isCustomResponseEnabled = storage[CustomResponseStorageKeys.CUSTOM_RESPONSE_ENABLED]
      const mockUtxos = storage[CustomResponseStorageKeys.MOCK_UTXOS]
      if (!impersonatedAddress) {
        return { error: "No impersonated address set" };
      }
      if (isCustomResponseEnabled) {
        Log.D("Returning custom UTxO response", mockUtxos)
        return {
          utxos: encodeUtxos(mockUtxos)
        }
      }
      if (blockfrostCache.utxos[impersonatedAddress]) {
        return { utxos: blockfrostCache.utxos[impersonatedAddress] };
      }

      const mainnet = !impersonatedAddress?.startsWith("addr_test");
      const stakeKey = stakeKeyFromAddress(impersonatedAddress);

      let allData: any[] = await getAllUtxos(mainnet, stakeKey);
      // We flatten all utxos into a single array
      const utxos = allData.flat();
      const utxosWithAssets = encodeUtxos(utxos);

      blockfrostCache.utxos[impersonatedAddress] = utxosWithAssets;
      return {
        utxos: utxosWithAssets,
      };
    }
    default:
      return { error: `Unrecognized action ${request.action}` };
  }
}

export interface AddressInfo {
  address: string,
  stake_address: string,
  amount: Quantity[],
  type: string,
  script: boolean,
}

async function getAddressInfo(
  mainnet: boolean, stakeKey: string
): Promise<AddressInfo[]> {
  const allData: AddressInfo[] = []
  let page = 1;
  while (true) {
    // We get all the addresses based on the stake key.
    const addresses = await callBlockfrost(mainnet, `/api/v0/accounts/${stakeKey}/addresses?page=${page}`);
    if (addresses.length === 0) {
      break;
    }
    const pageData = await Promise.all(
      Object.values<{ address: string }>(addresses).map(
        async ({ address }: { address: string }) =>
          await callBlockfrost<AddressInfo>(mainnet, `/api/v0/addresses/${address}`)
      )
    );
    allData.push(...pageData);
    page += 1;
  }
  return allData
}
async function getAllUtxos(mainnet: boolean, stakeKey: string): Promise<any[]> {
  let page = 1;
  const allData: any[] = [];
  while (true) {
    // We get all the addresses based on the stake key.
    const addresses = await callBlockfrost(mainnet, `/api/v0/accounts/${stakeKey}/addresses?page=${page}`);
    const pageData = await Promise.all(
      Object.values<{ address: string; }>(addresses).map(
        async ({ address }: { address: string; }) =>
          await callBlockfrost(mainnet, `/api/v0/addresses/${address}/utxos`)
      )
    );
    if (pageData.length <= 0) {
      break;
    }
    page += 1;
    allData.push(...pageData);
  }
  return allData;
}
