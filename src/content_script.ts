// --- Pre-warm the service worker so it's ready for real API calls ---
chrome.runtime.sendMessage({ action: "ping" });

// --- Inject the full implementation script and wait for it to load ---
// The injected script registers its message listener synchronously at top-level,
// so `load` firing guarantees the listener is ready to receive SORBET_CONFIG.
const scriptLoaded = new Promise<void>((resolve) => {
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = chrome.runtime.getURL("js/injectedScript.js");
  script.addEventListener("load", () => {
    script.remove();
    resolve();
  });
  script.addEventListener("error", (e) => {
    console.log(e);
    resolve();
  });
  (document.head || document.documentElement).appendChild(script);
});

// --- Read wallet config directly from storage (in parallel with script load) ---
const storageReady = new Promise<{ [key: string]: any }>((resolve) => {
  chrome.storage.sync.get(
    ["wrapWallet", "impersonatedAddress", "walletType", "shouldScanForAddresses"],
    resolve
  );
});

// --- Post the config only once both are ready, so the listener can't miss it ---
Promise.all([scriptLoaded, storageReady]).then(([, items]) => {
  window.postMessage(
    {
      type: "SORBET_CONFIG",
      payload: {
        wrapWallet: items.wrapWallet,
        impersonatedAddress: items.impersonatedAddress,
        walletType: items.walletType ?? "impersonate",
        shouldScanForAddresses: items.shouldScanForAddresses,
        extensionBaseURL: chrome.runtime.getURL(""),
      },
    },
    window.origin
  );
});

// --- Relay messages between MAIN world (injected script) and background ---
window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.type !== "FROM_INJECTED_SCRIPT") {
    return;
  }

  chrome.runtime.sendMessage(event.data.payload, (response) => {
    window.postMessage({ type: "FROM_CONTENT_SCRIPT", payload: response }, window.origin);
  });
});
