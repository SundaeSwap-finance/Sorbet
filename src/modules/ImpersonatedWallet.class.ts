import type {
  TConnectedApi,
  TDataSignature,
  TExperimentalApi,
  TPaginate,
} from "../../typings/cip30";
import { bech32ToHex } from "../utils/addresses";
import { assetsToEncodedBalance } from "../utils/balance";
import {
  sendMessageToBackground,
  sendMessageToBackground as sendMessageToBackground_FromInjected,
} from "../utils/sendMessageToBackground";
import { utxosToHexArray } from "../utils/utxo";
import { walletInvoked } from "./walletLog";
// import { Address } from "@dcspark/cardano-multiplatform-lib-browser";

/**
 * allow communication with background thread from popups in the same signature as utils/sendMessageToBackground
 * @param message
 * @returns
 */
async function sendMessageToBackground_FromPopup<R = any>(message: { action: string } & any) {
  return await new Promise<R>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (response) {
        resolve(response);
      } else {
        reject();
      }
    });
  });
}

export class ImpersonatedWallet implements TConnectedApi {
  /*
  public stakeKey: string;
  public network: number;
  public blockfrostUrl: string;
  */
  public experimental?: TExperimentalApi | undefined;

  private sendMessageToBackground: (message: { action: string } & any) => any;

  constructor(isInjected: boolean) {
    /** switch between to allow communication with background thread from popups */
    this.sendMessageToBackground = isInjected
      ? sendMessageToBackground_FromInjected
      : sendMessageToBackground_FromPopup;

    // TODO: This is hard-coded to get dApps to work, since we don't need to actually sign valid transactions,
    // but it'd still be nice to emulate choosing a collateral UTXO from the wallet.
    this.experimental = {
      getCollateral: async () => {
        const { collateral } = await sendMessageToBackground({
          action: "request_getCollateral",
        });
        return collateral;
      },
    };
    // Bind each of the methods to this, because shenanigans
    this.getUsedAddresses = this.getUsedAddresses.bind(this);
    this.getUnusedAddresses = this.getUnusedAddresses.bind(this);
    this.getBalance = this.getBalance.bind(this);
    this.getUtxos = this.getUtxos.bind(this);
    this.signData = this.signData.bind(this);
    this.signTx = this.signTx.bind(this);
    this.submitTx = this.submitTx.bind(this);
    this.getCollateral = this.getCollateral.bind(this);

    /**
     * @TODO Maybe figure out WASM bundling and use serialization if required.
     */
    // const serializedAddress = Address.from_bech32(address);
    // // this.stakeKey = serializedAddress.staking_cred()?.to_keyhash()?.to_bech32("stake") ?? "";
    // // this.network = serializedAddress.network_id();
  }

  async getBalance(): Promise<string> {
    const { balance } = await this.sendMessageToBackground({
      action: "request_getBalance",
    });

    walletInvoked("getBalance", [], balance);
    const encoded = assetsToEncodedBalance(balance);
    return encoded;
  }

  async getChangeAddress(): Promise<string> {
    const { impersonatedAddress } = await this.sendMessageToBackground({
      action: "query_walletConfig",
    });
    walletInvoked("getChangeAddress", [], impersonatedAddress);
    const impersonatedAddress_toHex = bech32ToHex(impersonatedAddress);
    return impersonatedAddress_toHex;
  }

  // TODO: This is hard-coded to get dApps to work, since we don't need to actually sign valid transactions,
  // but it'd still be nice to emulate choosing a collateral UTXO from the wallet.
  async getCollateral(params: { amount: string }): Promise<string[] | null> {
    const { collateral } = await sendMessageToBackground({
      action: "request_getCollateral",
    });
    return collateral;
  }

  async getNetworkId(): Promise<number> {
    const { network } = await this.sendMessageToBackground({
      action: "query_walletConfig",
    });
    walletInvoked("getNetworkId", [], network);
    return network;
  }

  // TODO: This is hard-coded to get dApps to work, since we don't need to actually sign valid transactions,
  // but it'd still be nice to emulate choosing a collateral UTXO from the wallet.
  async getRewardAddresses(): Promise<string[]> {
    const rewardAddresses = ["e1c0ff5904e5d29c1d85ef193acbe0c6eb7cddbcf3a0d2a593e96931c4"];
    walletInvoked("getRewardAddresses", [], rewardAddresses);
    return rewardAddresses;
  }

  async getUnusedAddresses(paginate?: TPaginate | undefined): Promise<string[]> {
    const { impersonatedAddress } = await this.sendMessageToBackground({
      action: "query_walletConfig",
    });
    walletInvoked("getUnusedAddresses", [paginate], impersonatedAddress);
    const unusedAddresses = [bech32ToHex(impersonatedAddress)];
    return unusedAddresses;
  }

  async getUsedAddresses(paginate?: TPaginate | undefined): Promise<string[]> {
    const { addresses } = await this.sendMessageToBackground({
      action: "request_getUsedAddresses",
      paginate,
    });

    walletInvoked("getUsedAddresses", [paginate], addresses);
    const addresses_toHex = addresses?.map((addr: string) => bech32ToHex(addr));
    return addresses_toHex;
  }

  async getUtxos(
    amount?: string | undefined,
    paginate?: TPaginate | undefined
  ): Promise<string[] | null> {
    const { utxos } = await this.sendMessageToBackground({
      action: "request_getUTXOs",
    });

    walletInvoked("getUtxos", [amount, paginate], utxos);

    const encodedUTXOs = utxosToHexArray(utxos);
    return encodedUTXOs;
  }

  // TODO: This is stubbed out, but it'd be nice to emulate something better here.
  async signData(addr: string, payload: string): Promise<TDataSignature> {
    const signedData: TDataSignature = {
      key: "",
      signature: "",
    };
    walletInvoked("signData", [addr, payload], signedData);
    return signedData;
  }

  // TODO: The response is hard-coded, but it'd be nice to emulate something nicer here.
  async signTx(tx: string, partialSign?: boolean | undefined): Promise<string> {
    console.log("Sorbet: asked to sign ", tx);
    const signedTx =
      "a1008182582078b0eff557a5468f74ca5cc03a55ad3f9310568a037f9b295360b9e9316c953d5840ca48874aba63b221ab7ee77763ea7de003d06cade0d606b83f1563d9342bb4dbc252a174565c641f220baa90a436277a9d11ef7170f04303b089bb4013612802";
    walletInvoked("signTx", [tx, partialSign], signedTx);
    return signedTx;
  }

  // TODO: The response is hard-coded, but it'd be nice to emulate something nicer here.
  async submitTx(tx: string): Promise<string> {
    console.log("Sorbet: asked to submit ", tx);
    const submittedTx = "beefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef";
    walletInvoked("submitTx", [tx], submittedTx);
    return submittedTx;
  }
}
