import { annotateAddressesInDom } from "./content/dom_scan";
import { installRelay } from "./content_relay";
import {
  BackgroundAction,
  WindowMessageType,
  callBackground,
  runtimeTransport,
  type InjectionConfig,
} from "./protocol";

// --- Pre-warm the service worker so it's ready for real API calls (best effort) ---
callBackground(runtimeTransport, BackgroundAction.PING, {}).catch(() => undefined);

installRelay();

const reportLoadFailure = (reason: string) => {
  console.error("[sorbet]", reason);
  window.postMessage({ type: WindowMessageType.SORBET_LOAD_FAILED, payload: reason }, window.origin);
};

// --- Inject the full implementation script and wait for it to load ---
// The injected script registers its message listener synchronously at top-level,
// so `load` firing guarantees the listener is ready to receive SORBET_CONFIG.
const scriptLoaded = new Promise<void>((resolve, reject) => {
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = chrome.runtime.getURL("js/injectedScript.js");
  script.addEventListener("load", () => {
    script.remove();
    resolve();
  });
  script.addEventListener("error", () => {
    script.remove();
    reject(new Error("Sorbet injected script failed to load (blocked by the page or missing)"));
  });
  (document.head || document.documentElement).appendChild(script);
});

// --- Ask the background for the settings (content scripts cannot read chrome.storage) ---
const configReady = callBackground(runtimeTransport, BackgroundAction.QUERY_INJECTION_CONFIG, {});

// --- Post the config only once both are ready, so the listener can't miss it ---
Promise.all([scriptLoaded, configReady])
  .then(([, settings]) => {
    // The page can read this message, so it carries only what installing the wallet needs.
    const payload: InjectionConfig = {
      walletType: settings.walletType,
      wrapWallet: settings.wrapWallet,
      overrideWallet: settings.overrideWallet,
      extensionBaseURL: chrome.runtime.getURL(""),
    };
    window.postMessage({ type: WindowMessageType.SORBET_CONFIG, payload }, window.origin);
    // The scanner runs here in the isolated world; trusted clicks only (see content/context_menu).
    if (settings.shouldScanForAddresses) annotateAddressesInDom(runtimeTransport);
  })
  .catch((e: unknown) => reportLoadFailure(e instanceof Error ? e.message : String(e)));
