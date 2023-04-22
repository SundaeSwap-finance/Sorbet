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

async function handleRequest(request: any) {
  switch (request.action) {
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
      const { impersonatedAddress, blockfrostApiKey } = await getFromStorage({
        impersonatedAddress: "",
        blockfrostApiKey: "",
      });
      if (!impersonatedAddress) {
        return { error: "No impersonated address set" };
      }
      if (blockfrostCache.usedAddresses[impersonatedAddress]) {
        return { addresses: blockfrostCache.usedAddresses[impersonatedAddress] };
      }

      let headers: Record<string, string> = {};
      if (blockfrostApiKey) {
        headers.project_id = blockfrostApiKey;
      }

      let fetchParams = {
        method: "GET",
        headers,
      };
      const blockfrostUrl = impersonatedAddress?.startsWith("addr_test")
        ? "https://cardano-preview.blockfrost.io"
        : "https://cardano-mainnet.blockfrost.io";
      const stakeKey = stakeKeyFromAddress(impersonatedAddress);
      const usedAddressesUrl = new URL(`/api/v0/accounts/${stakeKey}/addresses`, blockfrostUrl);
      usedAddressesUrl.searchParams.set("count", (request?.paginate?.limit ?? 100).toString());
      usedAddressesUrl.searchParams.set("page", (request?.paginate?.page ?? 1).toString());
      const res = await fetch(usedAddressesUrl, fetchParams);
      const addrs = await res.json();
      const addresses = addrs.map(({ address }: { address: string }) => {
        return address;
      });
      blockfrostCache.usedAddresses[impersonatedAddress] = addresses;
      return {
        id: request.id,
        addresses,
      };
    }
    case "request_getBalance": {
      const { impersonatedAddress, blockfrostApiKey } = await getFromStorage({
        impersonatedAddress: "",
        blockfrostApiKey: "",
      });
      if (!impersonatedAddress) {
        return { error: "No impersonated address set" };
      }
      if (blockfrostCache.balance[impersonatedAddress]) {
        return { balance: blockfrostCache.balance[impersonatedAddress] };
      }
      let headers: Record<string, string> = {};
      if (Boolean(blockfrostApiKey)) {
        headers.project_id = blockfrostApiKey;
      }

      let fetchParams = {
        method: "GET",
        headers,
      };

      const blockfrostUrl = impersonatedAddress?.startsWith("addr_test")
        ? "https://cardano-preview.blockfrost.io"
        : "https://cardano-mainnet.blockfrost.io";
      const stakeKey = stakeKeyFromAddress(impersonatedAddress);

      // We get all the addresses based on the stake key.
      const res = await fetch(
        new URL(`/api/v0/accounts/${stakeKey}/addresses`, blockfrostUrl),
        fetchParams
      );
      const addresses = await res.json();
      const allData = await Promise.all(
        Object.values<{ address: string }>(addresses).map(
          async ({ address }: { address: string }) => {
            const res = await fetch(
              new URL(`/api/v0/addresses/${address}`, blockfrostUrl),
              fetchParams
            );
            const { amount }: { amount: Quantity[] } = await res.json();
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

      // We fold all the asset data up into a single array.
      const balance = allData.reduce((acc, { ada, assets }) => {
        acc.coin = ada
          .reduce((total, { quantity }) => {
            total += Number(quantity);
            return total;
          }, 0)
          .toString();

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
        blockfrostApiKey: "",
      });
      if (!impersonatedAddress) {
        return { error: "No impersonated address set" };
      }
      if (blockfrostCache.utxos[impersonatedAddress]) {
        return { utxos: blockfrostCache.utxos[impersonatedAddress] };
      }
      let headers: Record<string, string> = {};
      if (Boolean(blockfrostApiKey)) {
        headers.project_id = blockfrostApiKey;
      }

      let fetchParams = {
        method: "GET",
        headers,
      };

      const blockfrostUrl = impersonatedAddress?.startsWith("addr_test")
        ? "https://cardano-preview.blockfrost.io"
        : "https://cardano-mainnet.blockfrost.io";
      const stakeKey = stakeKeyFromAddress(impersonatedAddress);

      // We get all the addresses based on the stake key.
      const res = await fetch(
        new URL(`/api/v0/accounts/${stakeKey}/addresses`, blockfrostUrl),
        fetchParams
      );
      const addresses = await res.json();
      const allData = await Promise.all(
        Object.values<{ address: string }>(addresses).map(
          async ({ address }: { address: string }) => {
            const res = await fetch(
              new URL(`/api/v0/addresses/${address}/utxos`, blockfrostUrl),
              fetchParams
            );
            const utxos: any = await res.json();

            return utxos;
          }
        )
      );
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
