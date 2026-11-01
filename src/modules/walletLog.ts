import { TConnectedApi } from "../../typings/cip30";
import { BackgroundAction, BackgroundTransport, callBackground } from "../protocol";
import { Log } from "../utils/log_util";

/** Type depicting CIP-30 wallet methods  */
type LoggableMethod = keyof Omit<TConnectedApi, "experimental">;

/** Interface depicting individual logs of CIP-30 wallet methods  */
export interface WalletLog<T extends LoggableMethod = any> {
  methodName: T;
  args: Parameters<TConnectedApi[T]>;
  result: Awaited<ReturnType<TConnectedApi[T]>>;
  created: number;
  /**
   * Origin of the page that made the call, stamped by the background from the message
   * sender (anything the page sends here is overwritten). Absent for extension pages.
   */
  origin?: string;
}

/** Construct a WalletLog and send it to the background over the wallet's own transport. Failures are logged, never thrown. */
export function walletInvoked<T extends LoggableMethod>(
  transport: BackgroundTransport,
  methodName: T,
  args: Parameters<TConnectedApi[T]>,
  result: Awaited<ReturnType<TConnectedApi[T]>>
): void {
  const payload = newWalletLog({ methodName, args, result });
  Log.D("walletInvoked", methodName);
  callBackground(transport, BackgroundAction.STORE_WALLET_LOG, { payload }).catch((error: unknown) => {
    Log.W(`Could not store wallet log for ${methodName}`, error);
  });
}

/**
 * Private helper to construct, set created date, and @return {WalletLog}
 */
const newWalletLog = (walletLog: Omit<WalletLog, "created">): WalletLog => ({
  ...walletLog,
  created: new Date().getTime(),
});
