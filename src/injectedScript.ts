import { annotateAddressesInDom } from "./injected/dom_scan";
import { initSorbetDOMObject } from "./injected/init_sorbet_dom";
import { Log } from "./utils/log_util";
import { sendMessageToBackground } from "./utils/sendMessageToBackground";

try {
  window.addEventListener("__sorbet_extensionBaseURL", async (event: CustomEventInit) => {
    Log.App.Init("injectedScript Starting..");

    // Check if the window.cardano object exists or create it
    if (typeof window.cardano === "undefined") {
      window.cardano = {};
    }

    // Check if the window.cardano.sorbet object exists or create it
    if (typeof window.cardano.sorbet === "undefined") {
      const { extensionBaseURL } = event.detail;
      initSorbetDOMObject(extensionBaseURL);
    }

    let { shouldScanForAddresses } = await sendMessageToBackground({
      action: "query_shouldScanForAddresses",
    });
    if (shouldScanForAddresses) {
      annotateAddressesInDom();
    } else {
      Log.D("address scanning disabled, this can be changed in the extension options");
    }

    Log.App.Init("injectedScript Complete.");
  });
} catch (e) {
  Log.E(e, "initialization error");
}
