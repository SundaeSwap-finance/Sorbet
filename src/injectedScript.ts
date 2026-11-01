import { initSorbetWallet } from "./injected/init_sorbet_dom";
import { WindowMessageType, type InjectionConfig } from "./protocol";
import { EWalletType, isWalletId } from "./types";
import { Log } from "./utils/log_util";
import { injectedTransport } from "./utils/sendMessageToBackground";

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

/** Shape check for the config message. The page shares this world, so this is not authentication. */
function parseConfig(value: unknown): InjectionConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>; // narrowed field by field below
  const walletType = v.walletType;
  if (walletType !== EWalletType.IMPERSONATE && walletType !== EWalletType.WRAP) return null;
  if (typeof v.extensionBaseURL !== "string") return null;
  if (!isNullableString(v.wrapWallet) || !isNullableString(v.overrideWallet)) return null;
  const wrapWallet = v.wrapWallet === null ? null : isWalletId(v.wrapWallet) ? v.wrapWallet : undefined;
  const overrideWallet =
    v.overrideWallet === null ? null : isWalletId(v.overrideWallet) ? v.overrideWallet : undefined;
  if (wrapWallet === undefined || overrideWallet === undefined) return null;
  return { walletType, wrapWallet, overrideWallet, extensionBaseURL: v.extensionBaseURL };
}

let configured = false;

// The content script posts the config once; only the first well-formed config is honored.
window.addEventListener("message", (event) => {
  if (configured || event.source !== window) return;
  const data: unknown = event.data;
  if (
    typeof data !== "object" ||
    data === null ||
    !("type" in data) ||
    data.type !== WindowMessageType.SORBET_CONFIG
  ) {
    return;
  }
  const config = parseConfig("payload" in data ? data.payload : undefined);
  if (!config) {
    Log.W("ignoring malformed SORBET_CONFIG");
    return;
  }
  configured = true;

  Log.App.Init("injectedScript starting (config via postMessage)..");
  const installed = initSorbetWallet(config, { p2p: false, transport: injectedTransport });
  if (!installed) {
    window.__sorbet_fail("Sorbet wallet could not be initialized (check the extension settings)");
    return;
  }
  Log.App.Init("injectedScript complete.");
});
