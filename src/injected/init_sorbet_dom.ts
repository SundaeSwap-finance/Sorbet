import { ImpersonatedWallet } from "../modules/ImpersonatedWallet.class";
import { EWalletType } from "../types";
import { Log } from "../utils/log_util";
import { sendMessageToBackground } from "../utils/sendMessageToBackground";
import { setAddress, addToAddressBook } from "./messages";

/**
 * Initialize the cardano.sorbet DOM object based on user preferences
 * @param extensionBaseURL 
 */
export async function initSorbetDOMObject(extensionBaseURL: string) {
    // Retrieve user preferences
    let { wallet, impersonatedAddress, walletType } = await sendMessageToBackground({
        action: "query_walletConfig",
    });
    // Initialize object based on user preferences
    if (walletType !== EWalletType.IMPERSONATE && wallet) {
        initializeSorbetWallet_NOT_Impersonate(walletType, wallet, extensionBaseURL);
    } else if (walletType === EWalletType.IMPERSONATE) {
        initSorbetWallet_Impersonate(extensionBaseURL, impersonatedAddress);
    } else {
        Log.W(`no wallet initiated.`);
    }
}

function initSorbetWallet_Impersonate(extensionBaseURL: string, impersonatedAddress: any) {
    try {
        let instance: ImpersonatedWallet;
        makeSorbetWallet("sorbet", extensionBaseURL, {
            enable: async function () {
                instance = new ImpersonatedWallet();
                return instance;
            },
            isEnabled: async function () {
                return instance instanceof ImpersonatedWallet;
            },
        });
        Log.App.Init(`wallet injected (impersonating: ${impersonatedAddress ?? "no wallet address set"}).`);
    } catch (e) {
        Log.E(e, "impersonate wallet initialization error")
    }
}

function initializeSorbetWallet_NOT_Impersonate(walletType: any, wallet: any, extensionBaseURL: string) {
    const domWalletName = walletType === EWalletType.OVERRIDE ? wallet : "sorbet";
    makeSorbetWallet(domWalletName, extensionBaseURL, {
        enable: async function () {
            return window.cardano[wallet].enable();
        },
        isEnabled: async function () {
            return window.cardano[wallet].isEnabled();
        },
    });
    {
        walletType === EWalletType.OVERRIDE
            ? Log.D(`wallet injected (overriding ${wallet}).`)
            : Log.D(`wallet injected (wrapping ${wallet}).`);
    }
}

/** Sorbet Wallet interface */
interface SorbetWallet {
    apiVersion: string,
    icon: string,
    name: string,
    setAddress: (a: string) => void,
    addToAddressBook: (a: string) => void,
    enable: () => Promise<any>,
    isEnabled: () => Promise<boolean>,
}
const makeSorbetWallet = (domWalletName: string, extensionBaseURL: string, enableFns: Pick<SorbetWallet, "enable" | "isEnabled">) => {
    window.cardano[domWalletName] = {
        ...newSorbetWallet_Base(extensionBaseURL),
        ...enableFns,
    }
}
const newSorbetWallet_Base = (extensionBaseURL: string): Omit<SorbetWallet, "enable" | "isEnabled"> => ({
    apiVersion: "0.1.0",
    icon: `${extensionBaseURL}sorbet.png`,
    name: "Sorbet",
    setAddress,
    addToAddressBook,
})

