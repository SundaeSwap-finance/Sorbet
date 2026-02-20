// --- Pre-warm the service worker so it's ready for real API calls ---
chrome.runtime.sendMessage({ action: "ping" });

// --- Read wallet config directly from storage and post to MAIN world ---
// This eliminates the background round-trip for initial config (saves 50-200ms).
chrome.storage.sync.get(
  ["wrapWallet", "impersonatedAddress", "walletType", "shouldScanForAddresses"],
  (items) => {
    const extensionBaseURL = chrome.runtime.getURL("");
    window.postMessage(
      {
        type: "SORBET_CONFIG",
        payload: {
          wrapWallet: items.wrapWallet,
          impersonatedAddress: items.impersonatedAddress,
          walletType: items.walletType ?? "impersonate",
          shouldScanForAddresses: items.shouldScanForAddresses,
          extensionBaseURL,
        },
      },
      window.origin
    );
  }
);

// --- Inject the full implementation script ---
const injectScriptFile = (filename: string) => {
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = chrome.runtime.getURL(filename);
  (document.head || document.documentElement).appendChild(script);
  script.addEventListener("error", (e) => {
    console.log(e);
  });
  script.addEventListener("load", () => {
    script.remove();
  });
};

injectScriptFile("js/injectedScript.js");

// --- Relay messages between MAIN world (injected script) and background ---
window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.type !== "FROM_INJECTED_SCRIPT") {
    return;
  }

  chrome.runtime.sendMessage(event.data.payload, (response) => {
    window.postMessage({ type: "FROM_CONTENT_SCRIPT", payload: response }, window.origin);
  });
});
