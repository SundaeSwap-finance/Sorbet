import { stakeKeyFromAddress } from "./utils/addresses";

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
  switch (request.action) {
    case "query_walletConfig":
      chrome.storage.sync.get(["wrappedWallet", "impersonatedWallet", "overriddenWallet"], (result) => {
        const network = result.impersonatedWallet?.startsWith("addr_test") ? 0 : 1;
        sendResponse({
          id: request.id,
          wrappedWallet: result.wrappedWallet,
          impersonatedWallet: result.impersonatedWallet,
          overriddenWallet: result.overriddenWallet,
          network,
        });
      });
      return true
      
    case "request_getUsedAddresses":
      chrome.storage.sync.get({ impersonatedWallet: "", blockfrostApiKey: "" }, (items) => {
        if (!items.impersonatedWallet) {
          sendResponse({ error: "No impersonated wallet set" });
          return;
        }
        if (blockfrostCache.usedAddresses[items.impersonatedWallet]) {
          sendResponse({ id: request.id, addresses: blockfrostCache.usedAddresses[items.impersonatedWallet] });
          return;
        }

        let headers: Record<string, string> = {};
        if (items?.blockfrostApiKey) {
          headers.project_id = items.blockfrostApiKey;
        }

        let fetchParams = {
          method: "GET",
          headers,
        };
        const blockfrostUrl = items.impersonatedWallet?.startsWith("addr_test") ? "https://cardano-preview.blockfrost.io" : "https://cardano-mainnet.blockfrost.io";
        const stakeKey = stakeKeyFromAddress(items.impersonatedWallet);
        const usedAddressesUrl = new URL(
          `/api/v0/accounts/${stakeKey}/addresses`,
          blockfrostUrl
        );
        usedAddressesUrl.searchParams.set("count", (request?.paginate?.limit ?? 100).toString());
        usedAddressesUrl.searchParams.set("page", (request?.paginate?.page ?? 1).toString());
        fetch(usedAddressesUrl, fetchParams)
          .then((res) => res.json())
          .then((addrs) => {
            const addresses = addrs.map(({ address }: { address: string }) => {
              return address;
            })
            blockfrostCache.usedAddresses[items.impersonatedWallet] = addresses;
            sendResponse({
              id: request.id,
              addresses,
            });
          });
      });

      return true;
    case "request_getBalance":
      chrome.storage.sync.get({ impersonatedWallet: "", blockfrostApiKey: "" }, (items) => {
        if (!items.impersonatedWallet) {
          sendResponse({ error: "No impersonated wallet set" });
          return;
        }
        if (blockfrostCache.balance[items.impersonatedWallet]) {
          sendResponse({ id: request.id, balance: blockfrostCache.balance[items.impersonatedWallet] });
          return;
        }
        let headers: Record<string, string> = {};
        if (items?.blockfrostApiKey) {
          headers.project_id = items.blockfrostApiKey;
        }

        let fetchParams = {
          method: "GET",
          headers,
        };
        
        const blockfrostUrl = items.impersonatedWallet?.startsWith("addr_test") ? "https://cardano-preview.blockfrost.io" : "https://cardano-mainnet.blockfrost.io";
        const stakeKey = stakeKeyFromAddress(items.impersonatedWallet);
        
        // We get all the addresses based on the stake key.
        fetch(
          new URL(`/api/v0/accounts/${stakeKey}/addresses`, blockfrostUrl),
          fetchParams
        )
          .then((res) => res.json())
          .then((addresses) =>
            Promise.all(
              Object.values<{ address: string }>(addresses).map(
                async ({ address }: { address: string }) => {
                  return fetch(
                    new URL(`/api/v0/addresses/${address}`, blockfrostUrl),
                    fetchParams
                  )
                    .then((res) => res.json())
                    .then(({ amount }: { amount: Quantity[] }) => {
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
                    });
                }
              )
            ).then((allData) => {
              // We fold all the asset data up into a single array.
              return allData.reduce((acc, { ada, assets }) => {
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
                    acc.multi_assets[policyId][tokenName] = Number(acc.multi_assets?.[policyId]?.[tokenName] ?? 0) + Number(quantity);
                  });
                }

                return acc;
              }, {} as Record<string, any>);
            })
          )
          .then((balance) => {
            blockfrostCache.balance[items.impersonatedWallet] = balance;
            sendResponse({
              id: request.id,
              balance
            });
          });
      });

      return true;
    default:
      console.log("Unrecognized message: ", request);
  }
});
