import { stakeKeyFromAddress } from "./utils/addresses";
import { getFromStorage } from "./utils/storage";

interface Asset {
  unit: string;
  amount: string;
}

interface Quantity {
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

async function callBlockfrost(mainnet: Boolean, path: string, params: Record<string, string> = {}): Promise<any> {
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
  for(const [key, value] of Object.entries(params)) {
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
    case "setAddress": {
      const { address } = request
      console.log("sorbet.setAddress setting", address)
      chrome.storage.sync.set({ impersonatedAddress: address }, function () {
        console.log("sorbet.setAddress", address)
      });
      return { address }
    }
    case "query_walletConfig": {
      const { walletType, impersonatedAddress, wallet } = await getFromStorage([
        "wallet",
        "impersonatedAddress",
        "walletType",
      ]);
      const network = impersonatedAddress?.startsWith("addr_test") ? 0 : 1;
      return {
        walletType,
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
        page:  (request?.paginate?.page ?? 1).toString(),
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
      const { impersonatedAddress } = await getFromStorage({
        impersonatedAddress: "",
      });
      if (!impersonatedAddress) {
        return { error: "No impersonated address set" };
      }
      if (blockfrostCache.balance[impersonatedAddress]) {
        return { balance: blockfrostCache.balance[impersonatedAddress] };
      }

      const mainnet = !impersonatedAddress?.startsWith("addr_test")
      const stakeKey = stakeKeyFromAddress(impersonatedAddress);

      const allData: { ada: Quantity[], assets: Quantity[] }[] = [];
      let page = 1;
      while(true) {
        // We get all the addresses based on the stake key.
        const addresses = await callBlockfrost(mainnet, `/api/v0/accounts/${stakeKey}/addresses?page=${page}`);
        if (addresses.length === 0) {
          break;
        }
        const pageData = await Promise.all(
          Object.values<{ address: string }>(addresses).map(
            async ({ address }: { address: string }) => {
              const { amount }: { amount: Quantity[] } = await callBlockfrost(mainnet, `/api/v0/addresses/${address}`);
              let ada: Quantity[] = [];
              let assets: Quantity[] = [];

              amount?.forEach((asset) => {
                if (asset.unit === "lovelace") {
                  ada.push(asset);
                  return;
                }

                assets.push(asset);
              });

              return { ada, assets };
            }
          )
        );
        allData.push(...pageData);
        page += 1;
      }

      // We fold all the asset data up into a single array.
      const balance = allData.reduce((acc, { ada, assets }) => {
        acc.coin = (Number(acc.coin ?? 0) + ada
          .reduce((total, { quantity }) => {
            total += Number(quantity);
            return total;
          }, 0)
        ).toString();

        if (assets) {
          if (!acc?.multi_assets) {
            acc.multi_assets = {};
          }

          assets.forEach(({ quantity, unit }) => {
            let policyId = unit.slice(0, 56);
            let tokenName = unit.slice(56);
            if (acc.multi_assets[policyId] === undefined) {
              acc.multi_assets[policyId] = {};
            }
            acc.multi_assets[policyId][tokenName] =
              Number(acc.multi_assets?.[policyId]?.[tokenName] ?? 0) + Number(quantity);
          });
        }

        return acc;
      }, {} as Record<string, any>);

      blockfrostCache.balance[impersonatedAddress] = balance;
      return {
        balance,
      };
    }
    case "request_getUTXOs": {
      const { impersonatedAddress, blockfrostApiKey } = await getFromStorage({
        impersonatedAddress: "",
      });
      if (!impersonatedAddress) {
        return { error: "No impersonated address set" };
      }
      if (blockfrostCache.utxos[impersonatedAddress]) {
        return { utxos: blockfrostCache.utxos[impersonatedAddress] };
      }

      const mainnet = !impersonatedAddress?.startsWith("addr_test");
      const stakeKey = stakeKeyFromAddress(impersonatedAddress);

      let page = 1;
      let allData: any[] = [];
      while(true) {
        // We get all the addresses based on the stake key.
        const addresses = await callBlockfrost(mainnet, `/api/v0/accounts/${stakeKey}/addresses?page=${page}`);
        const pageData = await Promise.all(
          Object.values<{ address: string }>(addresses).map(
            async ({ address }: { address: string }) => {
              const utxos: any = await callBlockfrost(mainnet, `/api/v0/addresses/${address}/utxos`);
              return utxos;
            }
          )
        );
        if (pageData.length <= 0) {
          break;
        }
        page += 1;
        allData.push(...pageData);
      }
      // We flatten all utxos into a single array
      const utxos = allData.flat();
      // Rencode utxos from blockfrost style unit/quantity tuples, to coin / multiasset objects
      const utxosWithAssets = utxos.map((utxo: any) => {
        const { address, tx_hash, output_index, amount } = utxo;
        let ada: Quantity[] = [];
        let assets: Quantity[] = [];

        amount?.forEach((asset: any) => {
          if (asset.unit === "lovelace") {
            ada.push(asset);
            return;
          }

          assets.push(asset);
        });

        const balance: any = {
          coin: ada.reduce((total: number, { quantity }: Quantity) => {
            total += Number(quantity);
            return total;
          }, 0),
        };

        if (assets) {
          balance.multi_assets = {};
          assets.forEach(({ quantity, unit }: Quantity) => {
            let policyId = unit.slice(0, 56);
            let tokenName = unit.slice(56);
            if (balance.multi_assets[policyId] === undefined) {
              balance.multi_assets[policyId] = {};
            }
            balance.multi_assets[policyId][tokenName] =
              Number(balance.multi_assets?.[policyId]?.[tokenName] ?? 0) + Number(quantity);
          });
        }

        return {
          address,
          tx_hash,
          output_index,
          amount: balance,
        };
      });

      blockfrostCache.utxos[impersonatedAddress] = utxosWithAssets;
      return {
        utxos: utxosWithAssets,
      };
    }
    default:
      return { error: `Unrecognized action ${request.action}` };
  }
}