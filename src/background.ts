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
      const { walletType, impersonatedWallet, wallet } = await getFromStorage([
        "wallet",
        "impersonatedWallet",
        "walletType",
      ]);
      const network = impersonatedWallet?.startsWith("addr_test") ? 0 : 1;
      return {
        walletType,
        wallet,
        impersonatedWallet,
        network,
      };
    }
    case "request_getUsedAddresses": {
      const { impersonatedWallet, blockfrostApiKey } = await getFromStorage({
        impersonatedWallet: "",
        blockfrostApiKey: "",
      });
      if (!impersonatedWallet) {
        return { error: "No impersonated wallet set" };
      }
      if (blockfrostCache.usedAddresses[impersonatedWallet]) {
        return { addresses: blockfrostCache.usedAddresses[impersonatedWallet] };
      }

      let headers: Record<string, string> = {};
      if (blockfrostApiKey) {
        headers.project_id = blockfrostApiKey;
      }

      let fetchParams = {
        method: "GET",
        headers,
      };
      const blockfrostUrl = impersonatedWallet?.startsWith("addr_test")
        ? "https://cardano-preview.blockfrost.io"
        : "https://cardano-mainnet.blockfrost.io";
      const stakeKey = stakeKeyFromAddress(impersonatedWallet);
      const usedAddressesUrl = new URL(`/api/v0/accounts/${stakeKey}/addresses`, blockfrostUrl);
      usedAddressesUrl.searchParams.set("count", (request?.paginate?.limit ?? 100).toString());
      usedAddressesUrl.searchParams.set("page", (request?.paginate?.page ?? 1).toString());
      const res = await fetch(usedAddressesUrl, fetchParams);
      const addrs = await res.json();
      const addresses = addrs.map(({ address }: { address: string }) => {
        return address;
      });
      blockfrostCache.usedAddresses[impersonatedWallet] = addresses;
      return {
        id: request.id,
        addresses,
      };
    }
    case "request_getBalance": {
      const { impersonatedWallet, blockfrostApiKey } = await getFromStorage({
        impersonatedWallet: "",
        blockfrostApiKey: "",
      });
      if (!impersonatedWallet) {
        return { error: "No impersonated wallet set" };
      }
      if (blockfrostCache.balance[impersonatedWallet]) {
        return { id: request.id, balance: blockfrostCache.balance[impersonatedWallet] };
      }
      let headers: Record<string, string> = {};
      if (Boolean(blockfrostApiKey)) {
        headers.project_id = blockfrostApiKey;
      }

      let fetchParams = {
        method: "GET",
        headers,
      };

      const blockfrostUrl = impersonatedWallet?.startsWith("addr_test")
        ? "https://cardano-preview.blockfrost.io"
        : "https://cardano-mainnet.blockfrost.io";
      const stakeKey = stakeKeyFromAddress(impersonatedWallet);

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

      blockfrostCache.balance[impersonatedWallet] = balance;
      return {
        id: request.id,
        balance,
      };
    }
    default:
      return { error: `Unrecognized action ${request.action}` };
  }
}
