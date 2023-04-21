import { ImpersonatedWallet } from "./modules/ImpersonatedWallet.class";
import { sendMessageToBackground } from "./utils/sendMessageToBackground";

try {
  window.addEventListener("__sorbet_extensionBaseURL", async (event: CustomEventInit) => {
    const { extensionBaseURL } = event.detail;

    // Check if the window.cardano object exists or create it
    if (typeof window.cardano === "undefined") {
      window.cardano = {};
    }

    // Check if the window.cardano.sorbet object exists or create it
    if (typeof window.cardano.sorbet === "undefined") {
      let { wrappedWallet, impersonatedWallet, overriddenWallet } = await sendMessageToBackground({ action: "query_walletConfig" });
      if (wrappedWallet) {
        window.cardano.sorbet = {
          apiVersion: "0.1.0",
          icon: `${extensionBaseURL}sorbet.png`,
          name: "Sorbet",
          enable: async function () {
            return window.cardano[wrappedWallet].enable();
          },
          isEnabled: async function () {
            return window.cardano[wrappedWallet].isEnabled();
          },
        };
        console.log(`Sorbet: wallet injected (wrapping ${wrappedWallet}).`);
      } else if (impersonatedWallet) {
        try {
          let instance: ImpersonatedWallet;
          window.cardano[overriddenWallet ?? "sorbet"] = {
            apiVersion: "0.1.0",
            icon: `${extensionBaseURL}sorbet.png`,
            name: "Sorbet",
            enable: async function () {
              instance = new ImpersonatedWallet();
              return instance;
            },
            isEnabled: async function () {
              return instance instanceof ImpersonatedWallet;
            },
          };
          console.log(
            `Sorbet: wallet injected (impersonating ${impersonatedWallet}).`
          );
        } catch (e) {
          console.log(e);
        }
      } else {
        console.log(`Sorbet: no wallet initiated.`);
      }
    }

    console.log("Sorbet: done.");
  });
} catch (e) {
  console.log(e);
}
