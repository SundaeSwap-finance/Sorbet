import type { TPaginate } from "../typings/cip30";
import type { WalletLog } from "./modules/walletLog";
import type { WalletInjectionSettings } from "./settings";
import type { NetworkId } from "./types";
import type { MultiAssetAmount, MultiAssetOut } from "./utils/balance";

/**
 * Typed protocol for messages handled by the background service worker.
 * Every sender builds requests from these types and unwraps replies with
 * `unwrapReply`; every reply is a `BackgroundReply` envelope.
 *
 * Who may send what is decided in the background from `chrome.runtime.MessageSender`:
 * web pages (content scripts, including relayed MAIN-world requests) need a site
 * permission for wallet data and address changes; extension pages are trusted.
 */
export const BackgroundAction = {
  PING: "ping",
  /** Web page: ask for wallet access (CIP-30 enable); prompts the user when not yet connected. */
  REQUEST_CONNECT: "requestConnect",
  /** Web page: whether the site is connected; never prompts (CIP-30 isEnabled). */
  IS_CONNECTED: "isConnected",
  /** Page Hooks API; needs the site's "hooks" permission or a one-time approval. */
  SET_ADDRESS: "setAddress",
  /** Page Hooks API; needs the site's "hooks" permission or a one-time approval. */
  ADD_TO_ADDRESS_BOOK: "addToAddressBook",
  /** Content-script context menu, sent only after a trusted user click; not page-relayable. */
  CONTEXT_MENU_SET_ADDRESS: "contextMenu_setAddress",
  /** Content-script context menu, sent only after a trusted user click; not page-relayable. */
  CONTEXT_MENU_ADD_TO_ADDRESS_BOOK: "contextMenu_addToAddressBook",
  /** Content script: settings it needs to install Sorbet (content scripts cannot read storage). */
  QUERY_INJECTION_CONFIG: "query_injectionConfig",
  STORE_WALLET_LOG: "store_walletLog",
  QUERY_WALLET_CONFIG: "query_walletConfig",
  GET_USED_ADDRESSES: "request_getUsedAddresses",
  GET_COLLATERAL: "request_getCollateral",
  GET_BALANCE: "request_getBalance",
  GET_UTXOS: "request_getUTXOs",
  /** Approval window (extension page only): details of a pending approval. */
  APPROVAL_GET: "approval_get",
  /** Approval window (extension page only): the user's decision. */
  APPROVAL_DECIDE: "approval_decide",
} as const;
export type BackgroundAction = (typeof BackgroundAction)[keyof typeof BackgroundAction];

const BACKGROUND_ACTIONS: ReadonlySet<string> = new Set(Object.values(BackgroundAction));

/** What a site asks the user to approve. */
export type ApprovalKind = "connect" | "setAddress" | "addToAddressBook";

/**
 * The user's answer. "connect" offers only allow_always/deny (connections are remembered);
 * setAddress/addToAddressBook offer allow_once (this request), allow_always (remember the
 * site's "hooks" permission), or deny.
 */
export type ApprovalDecision = "allow_once" | "allow_always" | "deny";

/** A pending approval as shown in the approval window. */
export interface ApprovalRequest {
  id: string;
  /** Origin of the requesting page, from chrome.runtime.MessageSender (not page-supplied). */
  origin: string;
  kind: ApprovalKind;
  /** The address to set or add, for setAddress/addToAddressBook. */
  address?: string;
}

/** Name of the port the approval window keeps open so the service worker stays alive. */
export const APPROVAL_KEEPALIVE_PORT = "sorbet-approval";

/** Request parameters per action (besides `action` and `id`). */
export interface BackgroundRequestParams {
  [BackgroundAction.PING]: {};
  [BackgroundAction.REQUEST_CONNECT]: {};
  [BackgroundAction.IS_CONNECTED]: {};
  [BackgroundAction.SET_ADDRESS]: { address: string };
  [BackgroundAction.ADD_TO_ADDRESS_BOOK]: { address: string };
  [BackgroundAction.CONTEXT_MENU_SET_ADDRESS]: { address: string };
  [BackgroundAction.CONTEXT_MENU_ADD_TO_ADDRESS_BOOK]: { address: string };
  [BackgroundAction.QUERY_INJECTION_CONFIG]: {};
  [BackgroundAction.STORE_WALLET_LOG]: { payload: WalletLog };
  [BackgroundAction.QUERY_WALLET_CONFIG]: {};
  [BackgroundAction.GET_USED_ADDRESSES]: { paginate?: TPaginate };
  [BackgroundAction.GET_COLLATERAL]: {};
  [BackgroundAction.GET_BALANCE]: {};
  [BackgroundAction.GET_UTXOS]: { amount?: string; paginate?: TPaginate };
  [BackgroundAction.APPROVAL_GET]: { approvalId: string };
  [BackgroundAction.APPROVAL_DECIDE]: { approvalId: string; decision: ApprovalDecision };
}

/** What the impersonating wallet needs. `network` is null without an address. */
export interface WalletConfigReply {
  impersonatedAddress: string;
  network: NetworkId | null;
}

/** Settings the content script needs; it cannot read chrome.storage itself. */
export type ContentScriptConfig = WalletInjectionSettings;

/** `data` of a successful reply per action. */
export interface BackgroundResponseData {
  [BackgroundAction.PING]: null;
  [BackgroundAction.REQUEST_CONNECT]: null;
  [BackgroundAction.IS_CONNECTED]: boolean;
  [BackgroundAction.SET_ADDRESS]: { address: string };
  [BackgroundAction.ADD_TO_ADDRESS_BOOK]: { address: string };
  [BackgroundAction.CONTEXT_MENU_SET_ADDRESS]: { address: string };
  [BackgroundAction.CONTEXT_MENU_ADD_TO_ADDRESS_BOOK]: { address: string };
  [BackgroundAction.QUERY_INJECTION_CONFIG]: ContentScriptConfig;
  [BackgroundAction.STORE_WALLET_LOG]: null;
  [BackgroundAction.QUERY_WALLET_CONFIG]: WalletConfigReply;
  /** Bech32 addresses. */
  [BackgroundAction.GET_USED_ADDRESSES]: string[];
  [BackgroundAction.GET_COLLATERAL]: string[] | null;
  [BackgroundAction.GET_BALANCE]: MultiAssetAmount;
  [BackgroundAction.GET_UTXOS]: MultiAssetOut[];
  [BackgroundAction.APPROVAL_GET]: ApprovalRequest;
  [BackgroundAction.APPROVAL_DECIDE]: null;
}

type BackgroundRequest<A extends BackgroundAction = BackgroundAction> = {
  action: A;
  id?: string;
} & BackgroundRequestParams[A];

/** Union of every concrete request; `switch (request.action)` narrows the params. */
export type AnyBackgroundRequest = { [A in BackgroundAction]: BackgroundRequest<A> }[BackgroundAction];

/**
 * Reply envelope. `refused` marks a refusal by the user or by site permissions
 * (CIP-30 APIError code -3) as opposed to a failure (code -2).
 */
export type BackgroundReply<A extends BackgroundAction = BackgroundAction> =
  | { id?: string; ok: true; data: BackgroundResponseData[A] }
  | { id?: string; ok: false; error: string; refused?: true };

export function isBackgroundRequest(value: unknown): value is AnyBackgroundRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "action" in value &&
    typeof value.action === "string" &&
    BACKGROUND_ACTIONS.has(value.action)
  );
}

/**
 * Actions a web page (MAIN world) may send through the content-script relay. The relay
 * rejects everything else, so new background actions are not page-reachable by default.
 * Being relayable is not being allowed: the background still checks site permissions.
 */
export const PAGE_RELAYABLE_ACTIONS: ReadonlySet<BackgroundAction> = new Set([
  BackgroundAction.REQUEST_CONNECT,
  BackgroundAction.IS_CONNECTED,
  BackgroundAction.QUERY_WALLET_CONFIG,
  BackgroundAction.GET_USED_ADDRESSES,
  BackgroundAction.GET_COLLATERAL,
  BackgroundAction.GET_BALANCE,
  BackgroundAction.GET_UTXOS,
  BackgroundAction.STORE_WALLET_LOG,
  BackgroundAction.SET_ADDRESS,
  BackgroundAction.ADD_TO_ADDRESS_BOOK,
]);

/** Actions whose reply may wait for the user to answer an approval window. */
export const APPROVAL_ACTIONS: ReadonlySet<BackgroundAction> = new Set([
  BackgroundAction.REQUEST_CONNECT,
  BackgroundAction.SET_ADDRESS,
  BackgroundAction.ADD_TO_ADDRESS_BOOK,
]);

/** Failure reported by (or while reaching) the background. */
export class BackgroundError extends Error {
  constructor(readonly action: string, message: string, readonly refused = false) {
    super(message);
    this.name = "BackgroundError";
  }
}

/**
 * Unwrap a raw reply. Throws BackgroundError for error replies, missing replies
 * (e.g. the background never answered), and malformed replies.
 */
export function unwrapReply<A extends BackgroundAction>(
  action: A,
  reply: unknown
): BackgroundResponseData[A] {
  if (typeof reply !== "object" || reply === null || !("ok" in reply)) {
    throw new BackgroundError(action, reply === undefined ? "No reply from background" : "Malformed reply from background");
  }
  if (reply.ok === true && "data" in reply) {
    return reply.data as BackgroundResponseData[A];
  }
  const error = "error" in reply && typeof reply.error === "string" ? reply.error : "Background request failed";
  throw new BackgroundError(action, error, "refused" in reply && reply.refused === true);
}

/** Delivers a request to the background and resolves its raw reply (undefined if none). */
export type BackgroundTransport = (request: AnyBackgroundRequest) => Promise<unknown>;

export async function callBackground<A extends BackgroundAction>(
  transport: BackgroundTransport,
  action: A,
  params: BackgroundRequestParams[A]
): Promise<BackgroundResponseData[A]> {
  const request = { ...params, action } as AnyBackgroundRequest;
  return unwrapReply(action, await transport(request));
}

/** Transport for extension pages and content scripts: chrome.runtime.sendMessage. */
export const runtimeTransport: BackgroundTransport = (request) => {
  const { promise, resolve } = Promise.withResolvers<unknown>();
  chrome.runtime.sendMessage(request, (reply) => {
    const error = chrome.runtime.lastError;
    resolve(error ? { id: request.id, ok: false, error: error.message ?? "No reply from background" } : reply);
  });
  return promise;
};

/** window.postMessage types between the content script and the MAIN-world scripts. */
export const WindowMessageType = {
  /** MAIN world -> content script: `{ type, payload: AnyBackgroundRequest & { id: string } }`. */
  FROM_INJECTED_SCRIPT: "FROM_INJECTED_SCRIPT",
  /** content script -> MAIN world: `{ type, payload: BackgroundReply & { id: string } }`, same id. */
  FROM_CONTENT_SCRIPT: "FROM_CONTENT_SCRIPT",
  /** content script -> MAIN world: `{ type, payload: InjectionConfig }`. */
  SORBET_CONFIG: "SORBET_CONFIG",
  /** content script -> MAIN world: the injected script could not be loaded; `payload` is a reason string. */
  SORBET_LOAD_FAILED: "SORBET_LOAD_FAILED",
} as const;

/**
 * What the content script posts into the page. Every page can read it, so it carries only
 * what installing the wallet object requires: never the address or other settings.
 */
export interface InjectionConfig extends Pick<WalletInjectionSettings, "walletType" | "wrapWallet" | "overrideWallet"> {
  extensionBaseURL: string;
}

/** Messages between extension pages that the background must not answer. */
export const PageMessageAction = {
  /** popup -> p2p popup window; answered with `{ popupWindowExists: true }` by that window only. */
  P2P_POPUP_EXISTS: "p2p_popup_exists",
} as const;
