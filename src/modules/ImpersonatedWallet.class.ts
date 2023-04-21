import type { TConnectedApi, TDataSignature, TExperimentalApi, TNetwork, TPaginate } from "../../typings/cip30";
import { sendMessageToBackground } from "../utils/sendMessageToBackground";
import { bech32ToHex, getNetworkPrefix, stakeKeyFromAddress } from "../utils/addresses";
import * as cbor from 'cbor-web';
// import { Address } from "@dcspark/cardano-multiplatform-lib-browser";

export class ImpersonatedWallet implements TConnectedApi {
  public stakeKey: string;
  public network: number;
  public blockfrostUrl: string;
  public balance: {coin: number, multi_assets: Record<string, Record<string, number>>};
  public experimental?: TExperimentalApi | undefined;

  constructor(public address: string) {
    const network = getNetworkPrefix(address) === "e0" ? 0 : 1;
    this.stakeKey = stakeKeyFromAddress(address);
    this.network = network;
    this.blockfrostUrl = `https://cardano-${network === 0 ? "preview" : "mainnet"}.blockfrost.io`;
    this.balance = {coin: 0, multi_assets: {}};
    this.experimental = {
      getCollateral: async () => {
        return [
          "82825820d060df960efa59b66ac8baedc42c61580128b1c75241ca74ed927708442d5df705825839014476a6f50d917710191e90ecc8e292fefc53dbedb2104837306d4e77c0ff5904e5d29c1d85ef193acbe0c6eb7cddbcf3a0d2a593e96931c41a004c4b40",
          "82825820cd407d5ddcfd7c7de172c16a2eb6cadcbac768a5e46bee139dc35fa756dfebf2048258390159c7da059a3259670ec5975ea426ac46be2850e8399fc558d0245d70c0ff5904e5d29c1d85ef193acbe0c6eb7cddbcf3a0d2a593e96931c41a004c4b40",
          "82825820cb7f7e9a68962bcded8b694b85e7911870c95aa9d3e2b02611201f71a5d06bd50482583901ef393a53e4368740c68bfda46de1300fa7229ac90cca0ad5c1ddb17bc0ff5904e5d29c1d85ef193acbe0c6eb7cddbcf3a0d2a593e96931c41a004c4b40"
        ];
      },
    }
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
    if (this.balance.coin == 0) {
      // There is a race condition or something happening here with the API.
      // If you step through the extension background service (I have debuggers in place), it will console the balance to the window.
      // However, if you don't, it just returns an address.
      const { balance } = await sendMessageToBackground({
        action: "request_getBalance",
        stakeKey: this.stakeKey,
        blockfrostUrl: this.blockfrostUrl,
      });
      this.balance = balance;
    }

    // rencode the multiassets to a map of buffers, parsing hex keys on the object to byte buffers
    let multiAsset = new Map<Buffer, Map<Buffer, number>>();
    let internedKeys: {[key: string]: Buffer} = {}
    for (const policyId of Object.keys(this.balance.multi_assets)) {
      for (const assetName of Object.keys(this.balance.multi_assets[policyId])) {
        const asset = this.balance.multi_assets[policyId][assetName];
        const policyIdBuffer = internedKeys[policyId] ?? Buffer.from(policyId, 'hex');
        const assetNameBuffer = internedKeys[assetName] ?? Buffer.from(assetName, 'hex');
        internedKeys[policyId] = policyIdBuffer;
        internedKeys[assetName] = assetNameBuffer;
        if (!multiAsset.has(policyIdBuffer)) {
          multiAsset.set(policyIdBuffer, new Map<Buffer, number>());
        }
        multiAsset.get(policyIdBuffer)?.set(assetNameBuffer, asset);
      }
    }
    const encoded = cbor.encode([Number(this.balance.coin), multiAsset]).toString('hex');
    return encoded;
  }

  async getChangeAddress(): Promise<string> {
    return bech32ToHex(this.address);
  }

  async getCollateral(params: { amount: string }): Promise<string[] | null> {
    return [
      "82825820d060df960efa59b66ac8baedc42c61580128b1c75241ca74ed927708442d5df705825839014476a6f50d917710191e90ecc8e292fefc53dbedb2104837306d4e77c0ff5904e5d29c1d85ef193acbe0c6eb7cddbcf3a0d2a593e96931c41a004c4b40",
      "82825820cd407d5ddcfd7c7de172c16a2eb6cadcbac768a5e46bee139dc35fa756dfebf2048258390159c7da059a3259670ec5975ea426ac46be2850e8399fc558d0245d70c0ff5904e5d29c1d85ef193acbe0c6eb7cddbcf3a0d2a593e96931c41a004c4b40",
      "82825820cb7f7e9a68962bcded8b694b85e7911870c95aa9d3e2b02611201f71a5d06bd50482583901ef393a53e4368740c68bfda46de1300fa7229ac90cca0ad5c1ddb17bc0ff5904e5d29c1d85ef193acbe0c6eb7cddbcf3a0d2a593e96931c41a004c4b40"
    ];
  }

  async getNetworkId(): Promise<number> {
    return this.network;
  }

  async getRewardAddresses(): Promise<string[]> {
    return ["e1c0ff5904e5d29c1d85ef193acbe0c6eb7cddbcf3a0d2a593e96931c4"];
  }

  async getUnusedAddresses(paginate?: TPaginate | undefined): Promise<string[]> {
    return [bech32ToHex(this.address)];
  }

  async getUsedAddresses(paginate?: TPaginate | undefined): Promise<string[]> {
    const { addresses } = await sendMessageToBackground({
      action: "request_getUsedAddresses",
      stakeKey: this.stakeKey,
      blockfrostUrl: this.blockfrostUrl,
      paginate,
    });

    const toHex = addresses?.map((addr: string) => bech32ToHex(addr));
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
