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
      const url = new URL(`/api/v0/accounts/${request.stakeKey}/addresses`, request.blockfrostUrl);
      url.searchParams.set("count", (request?.paginate?.limit ?? 100).toString());
      url.searchParams.set("page", (request?.paginate?.page ?? 1).toString());
      fetch(url, {
        method: "GET",
        headers: {
          project_id: request.blockfrostApiKey,
        },
      })
        .then((res) => res.json())
        .then((addresses) => {
          console.log(addresses);
          sendResponse(
            addresses.map(({ address }: { address: string }) => {
              return address;
            })
          );
        });

      return true;
    default:
      console.log("Unrecognized message: ", request);
  }
});
