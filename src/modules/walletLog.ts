import { TConnectedApi } from "../../typings/cip30";
import { sendMessageToBackground } from "../utils/sendMessageToBackground";

export const STORE_WALLET_LOG_ACTION = "store_walletLog";

/** Type depicting CIP-30 wallet methods  */
type LoggableMethod = keyof Omit<TConnectedApi, "experimental">;

/** Interface depicting individual logs of CIP-30 wallet methods  */
export interface WalletLog<T extends LoggableMethod = any> {
  methodName: T;
  args: Parameters<TConnectedApi[T]>;
  result: Awaited<ReturnType<TConnectedApi[T]>>;
  created: number;
}

/** Construct and send a new WalletLog request to the background thread */
export function walletInvoked<T extends LoggableMethod>(
  methodName: T,
  args: Parameters<TConnectedApi[T]>,
  result: Awaited<ReturnType<TConnectedApi[T]>>
): void {
  const request = {
    action: STORE_WALLET_LOG_ACTION,
    payload: newWalletLog({ methodName, args, result }),
  };
  console.log("[Sorbet: walletInvoked]", request.payload.methodName, "request:", request);
  sendMessageToBackground(request);
}

/**
 * Private helper to construct, set created date, and @return {WalletLog}
 */
const newWalletLog = (walletLog: Omit<WalletLog, "created">): WalletLog => ({
  ...walletLog,
  created: new Date().getTime(),
});
