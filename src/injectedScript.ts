import { ImpersonatedWallet } from "./modules/ImpersonatedWallet.class";
import { EWalletType } from "./types";
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
      let { wallet, impersonatedAddress, walletType } = await sendMessageToBackground({
        action: "query_walletConfig",
      });

      if (walletType !== EWalletType.IMPERSONATE && wallet) {
        window.cardano[walletType === EWalletType.OVERRIDE ? wallet : "sorbet"] = {
          apiVersion: "0.1.0",
          icon: `${extensionBaseURL}sorbet.png`,
          name: "Sorbet",
          enable: async function () {
            return window.cardano[wallet].enable();
          },
          isEnabled: async function () {
            return window.cardano[wallet].isEnabled();
          },
        };
        {
          walletType === EWalletType.OVERRIDE
            ? console.log(`Sorbet: wallet injected (overriding ${wallet}).`)
            : console.log(`Sorbet: wallet injected (wrapping ${wallet}).`);
        }
      } else if (walletType === EWalletType.IMPERSONATE && impersonatedAddress) {
        try {
          let instance: ImpersonatedWallet;
          window.cardano["sorbet"] = {
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
          console.log(`Sorbet: wallet injected (impersonating ${impersonatedAddress}).`);
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
