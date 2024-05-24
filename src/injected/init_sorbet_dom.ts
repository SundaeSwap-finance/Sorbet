import { ImpersonatedWallet } from "../modules/ImpersonatedWallet.class";
import { EWalletType } from "../types";
import { Log } from "../utils/log_util";
import { sendMessageToBackground } from "../utils/sendMessageToBackground";
import { addToAddressBook, setAddress } from "./messages";

/** The base name for the property in the cardano DOM object, e.g. cardano.sorbet, cardano.sorbet_p2p */
const SORBET_DOM_WALLET_NAME = "sorbet"
/**
 * Retrieve user preferences from background and initialize the cardano.sorbet DOM object.
 * *NOTE*: ignores p2p connection
 * @param extensionBaseURL 
 */
export async function initSorbetDOMObject(extensionBaseURL: string) {
    let { wallet, impersonatedAddress, walletType } = await sendMessageToBackground({
        action: "query_walletConfig",
    });
    initSorbetDOMObjectWithProperties(extensionBaseURL, wallet, impersonatedAddress, walletType)
}
/**
 * Use passed args to initialize the cardano.sorbet DOM object
 * @param extensionBaseURL 
 * @param wallet 
 * @param impersonatedAddress 
 * @param walletType 
 * @param p2pIsConnected 
 */
export async function initSorbetDOMObjectWithProperties(
    extensionBaseURL: string, wallet: string, impersonatedAddress: string, walletType: EWalletType, 
    p2pIsConnected = false, isInjected = true
) {
    if (walletType !== EWalletType.IMPERSONATE && wallet) {
        initializeSorbetWallet_NOT_Impersonate(walletType, wallet, extensionBaseURL, p2pIsConnected);
    } else if (walletType === EWalletType.IMPERSONATE) {
        initSorbetWallet_Impersonate(extensionBaseURL, impersonatedAddress, p2pIsConnected, isInjected);
    } else {
        Log.W(`no wallet initiated.`);
    }
}

function initSorbetWallet_Impersonate(extensionBaseURL: string, impersonatedAddress: any, p2pIsConnected: boolean, isInjected: boolean) {
    try {
        let instance: ImpersonatedWallet;
        const domWalletName = SORBET_DOM_WALLET_NAME + (p2pIsConnected ? '_p2p' : '')
        makeSorbetWallet(domWalletName, extensionBaseURL, {
            enable: async function () {
                instance = new ImpersonatedWallet(isInjected);
                return instance;
            },
            isEnabled: async function () {
                return instance instanceof ImpersonatedWallet;
            },
        });
        Log.App.Init(`${domWalletName} wallet injected (impersonating: ${impersonatedAddress ?? "no wallet address set"}).`);
    } catch (e) {
        Log.E(e, "impersonate wallet initialization error")
    }
}

function initializeSorbetWallet_NOT_Impersonate(walletType: any, wallet: any, extensionBaseURL: string, p2pIsConnected: boolean) {
    const domWalletName = (walletType === EWalletType.OVERRIDE ? wallet : SORBET_DOM_WALLET_NAME) + (p2pIsConnected ? '_p2p' : '');
    makeSorbetWallet(domWalletName, extensionBaseURL, {
        enable: async function () {
            return window.cardano[wallet].enable();
        },
        isEnabled: async function () {
            return window.cardano[wallet].isEnabled();
        },
    });
    Log.App.Init(`${domWalletName} wallet injected (${walletType === EWalletType.OVERRIDE ? 'overriding' : 'wrapping'} ${wallet}).`)
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
    const baseProperties = {
        apiVersion: "0.1.0",
        icon: `${extensionBaseURL}sorbet.png`,
        name: "Sorbet",
        setAddress,
        addToAddressBook,
    }
    window.cardano[domWalletName] = {
        ...baseProperties,
        ...enableFns,
    }
}

