import type { TConnectedApi, TDataSignature, TPaginate } from "../../typings/cip30";
import { bech32 } from "bech32";
import { sendMessageToBackground } from "../utils/sendMessageToBackground";
import { bech32ToHex, getNetworkPrefix, stakeKeyFromAddress } from "../utils/addresses";
// import { Address } from "@dcspark/cardano-multiplatform-lib-browser";

export class ImpersonatedWallet implements TConnectedApi {
  public stakeKey: string;
  public network: number;
  public blockfrostUrl: string;
  private blockfrostApiKey: string;

  constructor(public address: string, blockfrostApiKey: string) {
    const network = getNetworkPrefix(address) === "e0" ? 0 : 1;
    this.stakeKey = stakeKeyFromAddress(address);
    this.network = network;
    this.blockfrostApiKey = blockfrostApiKey;

    /**
     * @TODO Figure out WASM bundling and use serialization.
     */
    // const serializedAddress = Address.from_bech32(address);
    // // this.stakeKey = serializedAddress.staking_cred()?.to_keyhash()?.to_bech32("stake") ?? "";
    // // this.network = serializedAddress.network_id();
    this.blockfrostUrl = `https://cardano-${
      blockfrostApiKey.indexOf("mainnet") === 0 ? "mainnet" : "preivew"
    }.blockfrost.io`;
  }

  async getBalance(): Promise<string> {
    return "8200a0";
  }

  async getChangeAddress(): Promise<string> {
    return bech32ToHex(this.address);
  }

  async getCollateral(params: { amount: string }): Promise<string[] | null> {
    return [];
  }

  async getNetworkId(): Promise<number> {
    return this.network;
  }

  async getRewardAddresses(): Promise<string[]> {
    return [];
  }

  async getUnusedAddresses(paginate?: TPaginate | undefined): Promise<string[]> {
    return [bech32ToHex(this.address)];
  }

  async getUsedAddresses(paginate?: TPaginate | undefined): Promise<string[]> {
    const addresses = await sendMessageToBackground({
      action: "request_getUsedAddresses",
      stakeKey: this.stakeKey,
      blockfrostUrl: this.blockfrostUrl,
      blockfrostApiKey: this.blockfrostApiKey,
      paginate,
    });

    const toHex = addresses?.map((addr: string) => bech32ToHex(addr));
    console.log(toHex);
    return toHex;
  }

  async getUtxos(
    amount?: string | undefined,
    paginate?: TPaginate | undefined
  ): Promise<string[] | null> {
    return [];
  }

  async signData(addr: string, payload: string): Promise<TDataSignature> {
    return {
      key: "",
      signature: "",
    };
  }

  async signTx(tx: string, partialSign?: boolean | undefined): Promise<string> {
    return "";
  }

  async submitTx(tx: string): Promise<string> {
    return "";
  }
}
