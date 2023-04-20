import type { TConnectedApi, TDataSignature, TNetwork, TPaginate } from "../../typings/cip30";
import { bech32 } from "bech32";
import { sendMessageToBackground } from "../utils/sendMessageToBackground";
import { bech32ToHex, getNetworkPrefix, stakeKeyFromAddress } from "../utils/addresses";
// import { Address } from "@dcspark/cardano-multiplatform-lib-browser";

export class ImpersonatedWallet implements TConnectedApi {
  public stakeKey: string;
  public network: number;
  public blockfrostUrl: string;

  constructor(public address: string) {
    const network = getNetworkPrefix(address) === "e0" ? 0 : 1;
    this.stakeKey = stakeKeyFromAddress(address);
    this.network = network;
    this.blockfrostUrl = `https://cardano-${network === 0 ? "preview" : "mainnet"}.blockfrost.io`;

    /**
     * @TODO Maybe figure out WASM bundling and use serialization if required.
     */
    // const serializedAddress = Address.from_bech32(address);
    // // this.stakeKey = serializedAddress.staking_cred()?.to_keyhash()?.to_bech32("stake") ?? "";
    // // this.network = serializedAddress.network_id();
  }

  async getBalance(): Promise<string> {
    // There is a race condition or something happening here with the API.
    // If you step through the extension background service (I have debuggers in place), it will console the balance to the window.
    // However, if you don't, it just returns an address.
    const balance = await sendMessageToBackground({
      action: "request_getBalance",
      stakeKey: this.stakeKey,
      blockfrostUrl: this.blockfrostUrl,
    });

    console.log(balance);

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
