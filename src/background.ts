chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'query_isWrapped':
      chrome.storage.local.get(['wrappedWallet'], (result) => {
        if (result.wrappedWallet) {
          sendResponse({ result: true, wrappedWallet: result.wrappedWallet });
        } else {
          sendResponse({ result: false })
        }
      });
      return true;
    default:
      console.log("Unrecognized message: ", request);
  }
})