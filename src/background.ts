interface Asset {
  unit: string;
  amount: string;
}

interface Quantity {
  unit: string;
  quantity: string;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "query_isWrapped":
      chrome.storage.local.get(["wrappedWallet"], (result) => {
        if (Boolean(result.wrappedWallet)) {
          sendResponse({ result: true, wrappedWallet: result.wrappedWallet });
        } else {
          sendResponse({ result: false });
        }
      });
      return true;

    case "query_isImpersonated":
      chrome.storage.local.get(["impersonatedWallet"], (result) => {
        if (result.impersonatedWallet) {
          sendResponse({
            result: true,
            impersonatedWallet: result.impersonatedWallet,
          });
        } else {
          sendResponse({ result: false });
        }
      });

      return true;
    case "request_getUsedAddresses":
      chrome.storage.sync.get({ blockfrostApiKey: "" }, (items) => {
        let headers: Record<string, string> = {};
        if (items?.blockfrostApiKey) {
          headers.project_id = items.blockfrostApiKey;
        }

        let fetchParams = {
          method: "GET",
          headers,
        };
        const usedAddressesUrl = new URL(
          `/api/v0/accounts/${request.stakeKey}/addresses`,
          request.blockfrostUrl
        );
        usedAddressesUrl.searchParams.set("count", (request?.paginate?.limit ?? 100).toString());
        usedAddressesUrl.searchParams.set("page", (request?.paginate?.page ?? 1).toString());
        fetch(usedAddressesUrl, fetchParams)
          .then((res) => res.json())
          .then((addresses) => {
            sendResponse(
              addresses.map(({ address }: { address: string }) => {
                return address;
              })
            );
          });
      });

      return true;
    case "request_getBalance":
      chrome.storage.sync.get({ blockfrostApiKey: "" }, (items) => {
        let headers: Record<string, string> = {};
        if (items?.blockfrostApiKey) {
          headers.project_id = items.blockfrostApiKey;
        }

        let fetchParams = {
          method: "GET",
          headers,
        };

        // We get all the addresses based on the stake key.
        fetch(
          new URL(`/api/v0/accounts/${request.stakeKey}/addresses`, request.blockfrostUrl),
          fetchParams
        )
          .then((res) => res.json())
          .then((addresses) =>
            Promise.all(
              Object.values<{ address: string }>(addresses).map(
                async ({ address }: { address: string }) => {
                  return fetch(
                    new URL(`/api/v0/addresses/${address}`, request.blockfrostUrl),
                    fetchParams
                  )
                    .then((res) => res.json())
                    .then(({ amount }: { amount: Quantity[] }) => {
                      debugger;
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
              debugger;
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
                    acc.multi_assets[unit] = (
                      Number(acc.multi_assets?.[unit] ?? 0) + Number(quantity)
                    ).toString();
                  });
                }

                return acc;
              }, {} as Record<string, any>);
            })
          )
          .then((allAssets) => {
            debugger;
            sendResponse(allAssets);
          });
      });

      return true;
    default:
      console.log("Unrecognized message: ", request);
  }
});
