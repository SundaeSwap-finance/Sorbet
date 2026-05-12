import { initSorbetDOMObjectWithProperties } from "./injected/init_sorbet_dom";
import { Log } from "./utils/log_util";
import { sendMessageToBackground } from "./utils/sendMessageToBackground";

try {
  // Listen for config posted by content_script (direct storage read, no background round-trip).
  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.data?.type !== "SORBET_CONFIG") {
      return;
    }

    Log.App.Init("injectedScript starting (config via postMessage)..");

    const { extensionBaseURL, wrapWallet, impersonatedAddress, walletType, shouldScanForAddresses } =
      event.data.payload;

    // Ensure window.cardano exists (stub should have created it, but be defensive).
    if (typeof window.cardano === "undefined") {
      window.cardano = {} as any;
    }

    // Wire up the real wallet implementation and signal readiness to the stub.
    initSorbetDOMObjectWithProperties(extensionBaseURL, wrapWallet, impersonatedAddress, walletType);

    // Resolve the stub's ready promise so any pending enable() calls complete.
    if (typeof (window as any).__sorbet_resolve_ready === "function") {
      (window as any).__sorbet_resolve_ready();
    }

    // DOM scanning — lazy-loaded only when enabled.
    if (shouldScanForAddresses) {
      const { annotateAddressesInDom } = await import("./injected/dom_scan");
      annotateAddressesInDom();
    } else {
      Log.D("address scanning disabled, this can be changed in the extension options");
    }

    Log.App.Init("injectedScript complete.");
  });
} catch (e) {
  Log.E(e, "initialization error");
}
