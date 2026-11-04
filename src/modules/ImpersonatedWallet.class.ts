import type {
  TConnectedApi,
  TDataSignature,
  TExperimentalApi,
  TPaginate,
} from "../../typings/cip30";
import {
  BackgroundAction,
  BackgroundError,
  BackgroundRequestParams,
  BackgroundResponseData,
  BackgroundTransport,
  callBackground,
} from "../protocol";
import { bech32ToHex } from "../utils/addresses";
import { assetsToEncodedBalance } from "../utils/balance";
import { Log } from "../utils/log_util";
import { utxosToHexArray } from "../utils/utxo";
import { walletInvoked } from "./walletLog";
import { apiError, backgroundErrorToApiError } from "./apiError";

export class ImpersonatedWallet implements TConnectedApi {
  public experimental?: TExperimentalApi | undefined;

  constructor(private readonly transport: BackgroundTransport) {
    // TODO: This is hard-coded to get dApps to work, since we don't need to actually sign valid transactions,
    // but it'd still be nice to emulate choosing a collateral UTXO from the wallet.
    this.experimental = { getCollateral: this.getCollateral };
  }

  /** Every background request goes through here so failures surface as APIError -2. */
  private call = async <A extends BackgroundAction>(
    action: A,
    params: BackgroundRequestParams[A]
  ): Promise<BackgroundResponseData[A]> => {
    try {
      return await callBackground(this.transport, action, params);
    } catch (error) {
      if (error instanceof BackgroundError) {
        throw backgroundErrorToApiError(error);
      }
      throw error;
    }
  };

  /** Runs a wallet method body; non-API failures (e.g. encoding errors) become APIError -2 too. */
  private guard = async <T>(body: () => Promise<T>): Promise<T> => {
    try {
      return await body();
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && "info" in error) {
        throw error;
      }
      throw apiError(error instanceof Error ? error.message : "Unknown wallet error");
    }
  };

  private requireAddress = async (): Promise<string> => {
    const { impersonatedAddress } = await this.call(BackgroundAction.QUERY_WALLET_CONFIG, {});
    if (!impersonatedAddress) {
      throw apiError("No impersonated address set");
    }
    return impersonatedAddress;
  };

  getBalance = (): Promise<string> =>
    this.guard(async () => {
      const balance = await this.call(BackgroundAction.GET_BALANCE, {});
      const encoded = assetsToEncodedBalance(balance);
      walletInvoked(this.transport, "getBalance", [], encoded);
      return encoded;
    });

  getChangeAddress = (): Promise<string> =>
    this.guard(async () => {
      const hex = bech32ToHex(await this.requireAddress());
      walletInvoked(this.transport, "getChangeAddress", [], hex);
      return hex;
    });

  // TODO: This is hard-coded to get dApps to work, since we don't need to actually sign valid transactions,
  // but it'd still be nice to emulate choosing a collateral UTXO from the wallet.
  getCollateral = (_params?: { amount: string }): Promise<string[] | null> =>
    this.guard(() => this.call(BackgroundAction.GET_COLLATERAL, {}));

  getNetworkId = (): Promise<number> =>
    this.guard(async () => {
      const { network } = await this.call(BackgroundAction.QUERY_WALLET_CONFIG, {});
      if (network === null) {
        throw apiError("No impersonated address set");
      }
      walletInvoked(this.transport, "getNetworkId", [], network);
      return network;
    });

  // TODO: This is hard-coded to get dApps to work, since we don't need to actually sign valid transactions,
  // but it'd still be nice to emulate choosing a collateral UTXO from the wallet.
  getRewardAddresses = async (): Promise<string[]> => {
    const rewardAddresses = ["e1c0ff5904e5d29c1d85ef193acbe0c6eb7cddbcf3a0d2a593e96931c4"];
    walletInvoked(this.transport, "getRewardAddresses", [], rewardAddresses);
    return rewardAddresses;
  };

  getUnusedAddresses = (paginate?: TPaginate): Promise<string[]> =>
    this.guard(async () => {
      const hexAddresses = [bech32ToHex(await this.requireAddress())];
      walletInvoked(this.transport, "getUnusedAddresses", [paginate], hexAddresses);
      return hexAddresses;
    });

  getUsedAddresses = (paginate?: TPaginate): Promise<string[]> =>
    this.guard(async () => {
      const addresses = await this.call(BackgroundAction.GET_USED_ADDRESSES, { paginate });
      walletInvoked(this.transport, "getUsedAddresses", [paginate], addresses);
      return addresses.map((addr) => bech32ToHex(addr));
    });

  getUtxos = (amount?: string, paginate?: TPaginate): Promise<string[] | null> =>
    this.guard(async () => {
      const utxos = await this.call(BackgroundAction.GET_UTXOS, { amount, paginate });
      const encoded = utxosToHexArray(utxos);
      walletInvoked(this.transport, "getUtxos", [amount, paginate], encoded);
      return encoded;
    });

  // TODO: This is stubbed out, but it'd be nice to emulate something better here.
  signData = async (addr: string, payload: string): Promise<TDataSignature> => {
    const signedData: TDataSignature = {
      key: "",
      signature: "",
    };
    walletInvoked(this.transport, "signData", [addr, payload], signedData);
    return signedData;
  };

  // TODO: The response is hard-coded, but it'd be nice to emulate something nicer here.
  signTx = async (tx: string, partialSign?: boolean): Promise<string> => {
    Log.D("Sorbet: asked to sign", tx);
    const signedTx =
      "a1008182582078b0eff557a5468f74ca5cc03a55ad3f9310568a037f9b295360b9e9316c953d5840ca48874aba63b221ab7ee77763ea7de003d06cade0d606b83f1563d9342bb4dbc252a174565c641f220baa90a436277a9d11ef7170f04303b089bb4013612802";
    walletInvoked(this.transport, "signTx", [tx, partialSign], signedTx);
    return signedTx;
  };

  // TODO: The response is hard-coded, but it'd be nice to emulate something nicer here.
  submitTx = async (tx: string): Promise<string> => {
    Log.D("Sorbet: asked to submit", tx);
    const submittedTx = "beefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef";
    walletInvoked(this.transport, "submitTx", [tx], submittedTx);
    return submittedTx;
  };
}
