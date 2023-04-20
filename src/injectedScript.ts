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
      let isWrapped = await sendMessageToBackground({ action: "query_isWrapped" });
      let isImpersonated = await sendMessageToBackground({ action: "query_isImpersonated" });
      if (isWrapped.result) {
        window.cardano.sorbet = {
          apiVersion: "0.1.0",
          icon: `${extensionBaseURL}sorbet.png`,
          name: "Sorbet",
          enable: async function () {
            return window.cardano[isWrapped.wrappedWallet].enable();
          },
          isEnabled: async function () {
            return window.cardano[isWrapped.wrappedWallet].isEnabled();
          },
        };
        console.log(`Sorbet: wallet injected (wrapping ${isWrapped.wrappedWallet}).`);
      } else if (isImpersonated.result && isImpersonated?.impersonatedWallet) {
        try {
          let instance: ImpersonatedWallet;
          window.cardano.sorbet = {
            apiVersion: "0.1.0",
            icon: `${extensionBaseURL}sorbet.png`,
            name: "Sorbet",
            enable: async function () {
              instance = new ImpersonatedWallet(isImpersonated.impersonatedWallet);
              return instance;
            },
            isEnabled: async function () {
              return instance instanceof ImpersonatedWallet;
            },
          };
          console.log(
            `Sorbet: wallet injected (impersonating ${isImpersonated.impersonatedWallet}).`
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
