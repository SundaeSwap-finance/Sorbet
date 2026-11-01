import { apiError, backgroundErrorToApiError } from "../modules/apiError";
import { ImpersonatedWallet } from "../modules/ImpersonatedWallet.class";
import {
  BackgroundAction,
  BackgroundError,
  callBackground,
  type BackgroundTransport,
  type InjectionConfig,
} from "../protocol";
import { EWalletType, type WalletId } from "../types";
import { Log } from "../utils/log_util";
import { addToAddressBook, setAddress } from "./messages";

/** The base name for the property in the cardano DOM object, e.g. cardano.sorbet, cardano.sorbet_p2p */
const SORBET_DOM_WALLET_NAME = "sorbet";

interface CardanoWallet {
  enable: () => Promise<unknown>;
  isEnabled: () => Promise<boolean>;
}

const isCardanoWallet = (value: unknown): value is CardanoWallet =>
  typeof value === "object" &&
  value !== null &&
  "enable" in value &&
  typeof value.enable === "function" &&
  "isEnabled" in value &&
  typeof value.isEnabled === "function";

/**
 * Install the Sorbet wallet on `window.cardano` per the config.
 * Returns whether a wallet object was installed; failures are logged, never thrown.
 */
export function initSorbetWallet(
  config: InjectionConfig,
  options: { p2p: boolean; transport: BackgroundTransport }
): boolean {
  Log.D("initSorbetWallet", { ...config, ...options, transport: undefined });
  try {
    if (typeof window.cardano === "undefined") {
      window.cardano = {};
    }
    const domWalletName = SORBET_DOM_WALLET_NAME + (options.p2p ? "_p2p" : "");
    // Capture the original before anything replaces it, and keep capturing later assignments.
    const original = options.p2p ? null : captureOverriddenWallet(config.overrideWallet);

    if (config.walletType === EWalletType.IMPERSONATE) {
      // One wallet instance per page, handed out once the user has connected this site.
      let instance: ImpersonatedWallet | null = null;
      const wallet = makeSorbetWallet(domWalletName, config.extensionBaseURL, {
        enable: async () => {
          try {
            await callBackground(options.transport, BackgroundAction.REQUEST_CONNECT, {});
          } catch (e) {
            throw e instanceof BackgroundError ? backgroundErrorToApiError(e) : e;
          }
          instance ??= new ImpersonatedWallet(options.transport);
          return instance;
        },
        isEnabled: async () => {
          try {
            return await callBackground(options.transport, BackgroundAction.IS_CONNECTED, {});
          } catch (e) {
            throw e instanceof BackgroundError ? backgroundErrorToApiError(e) : e;
          }
        },
      });
      installOverride(config.overrideWallet, original, wallet);
      Log.App.Init(`${domWalletName} wallet injected (impersonating).`);
      return true;
    }

    const wrapId = config.wrapWallet;
    if (!wrapId) {
      Log.W("no wallet to wrap configured; Sorbet wallet not installed.");
      return false;
    }
    const wrapped = (): CardanoWallet => {
      const target = wrapId === config.overrideWallet ? original?.get() : window.cardano[wrapId];
      if (!isCardanoWallet(target)) {
        throw apiError(`Wrapped wallet "${wrapId}" is not available on this page`);
      }
      return target;
    };
    const wallet = makeSorbetWallet(domWalletName, config.extensionBaseURL, {
      enable: async () => wrapped().enable(),
      isEnabled: async () => wrapped().isEnabled(),
    });
    installOverride(config.overrideWallet, original, wallet);
    Log.App.Init(`${domWalletName} wallet injected (wrapping ${wrapId}).`);
    return true;
  } catch (e) {
    Log.E(e, "sorbet wallet initialization error");
    return false;
  }
}

interface OriginalWalletSlot {
  get: () => unknown;
  set: (value: unknown) => void;
}

/** Remember the current `window.cardano[id]` so Sorbet can delegate to it after replacing it. */
function captureOverriddenWallet(id: WalletId | null): OriginalWalletSlot | null {
  if (!id) return null;
  let current: unknown = window.cardano[id];
  return { get: () => current, set: (value) => (current = value) };
}

/**
 * Make `window.cardano[id]` resolve to the Sorbet wallet. Later assignments by the real wallet's
 * extension are captured as the original instead of replacing Sorbet.
 */
function installOverride(
  id: WalletId | null,
  original: OriginalWalletSlot | null,
  sorbetWallet: object
): void {
  if (!id || !original) return;
  Object.defineProperty(window.cardano, id, {
    configurable: true,
    enumerable: true,
    get: () => sorbetWallet,
    set: (value: unknown) => original.set(value),
  });
}

const makeSorbetWallet = (
  domWalletName: string,
  extensionBaseURL: string,
  enableFns: CardanoWallet
): object => {
  const icon = `${extensionBaseURL}sorbet.png`;
  const wallet = {
    apiVersion: "0.1.0",
    icon,
    name: "Sorbet",
    setAddress,
    addToAddressBook,
    ...enableFns,
  };
  window.cardano[domWalletName] = wallet;

  // Hand the real enable/isEnabled/icon to the stub so early callers complete.
  if (domWalletName === SORBET_DOM_WALLET_NAME && typeof window.__sorbet_patch_api === "function") {
    window.__sorbet_patch_api(enableFns.enable, enableFns.isEnabled, icon);
  }
  return wallet;
};
