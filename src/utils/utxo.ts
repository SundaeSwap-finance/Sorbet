import * as cbor from "cbor-web";
import { Quantity } from "../background";
import { bech32ToHex } from "./addresses";
import { Log } from "./log_util";

/** Common utxo fields */
interface UTxOBase {
  address: string;
  tx_hash: string;
  output_index: number;
}
/** Blockfrost style unit/quantity tuples */
export interface UTxO extends UTxOBase {
  amount: Quantity[];
}
/** Coin / MultiAsset objects */
interface UTxOWithAssets extends UTxOBase {
  amount: MultiAssetAmount;
}
interface MultiAssetIn {
  address: any;
  tx_hash: any;
  output_index: any;
  amount: Quantity[];
}
export interface MultiAssetOut {
  address: any;
  tx_hash: any;
  output_index: any;
  amount: MultiAssetAmount;
}
export interface MultiAssetAmount<C = number> {
  coin: C;
  multi_assets?: { [policyId: string]: { [tokenName: string]: number } };
}

export function utxosToHexArray(utxos: UTxOWithAssets[]) {
  const encodedUTXOs = [];
  try {
    for (const utxo of utxos) {
      let amount: bigint | (bigint | Map<Buffer, Map<Buffer, bigint>>)[] = BigInt(utxo.amount.coin);
      if (utxo.amount.multi_assets && Object.keys(utxo.amount.multi_assets).length > 0) {
        // rencode the multiassets to a map of buffers, parsing hex keys on the object to byte buffers
        let multiAsset = new Map<Buffer, Map<Buffer, bigint>>();
        let internedKeys: { [key: string]: Buffer } = {};
        for (const policyId of Object.keys(utxo.amount.multi_assets)) {
          for (const assetName of Object.keys(utxo.amount.multi_assets[policyId])) {
            const asset = utxo.amount.multi_assets[policyId][assetName];
            const policyIdBuffer = internedKeys[policyId] ?? Buffer.from(policyId, "hex");
            const assetNameBuffer = internedKeys[assetName] ?? Buffer.from(assetName, "hex");
            internedKeys[policyId] = policyIdBuffer;
            internedKeys[assetName] = assetNameBuffer;
            if (!multiAsset.has(policyIdBuffer)) {
              multiAsset.set(policyIdBuffer, new Map<Buffer, bigint>());
            }
            multiAsset.get(policyIdBuffer)?.set(assetNameBuffer, BigInt(asset));
          }
        }
        amount = [BigInt(utxo.amount.coin), multiAsset];
      }

      encodedUTXOs.push(
        cbor
          .encodeOne(
            [
              [Buffer.from(utxo.tx_hash, "hex"), utxo.output_index],
              [Buffer.from(bech32ToHex(utxo.address), "hex"), amount],
            ],
            {
              collapseBigIntegers: true,
              highWaterMark: 65535,
            }
          )
          .toString("hex")
      );
    }
    return encodedUTXOs;
  } catch (e) {
    return encodedUTXOs;
  }
}

export function encodeUtxos(utxos: MultiAssetIn[]): MultiAssetOut[] {
  try {
    // Rencode utxos from blockfrost style unit/quantity tuples, to coin / multiasset objects
    const utxosWithAssets = utxos.map((utxo): MultiAssetOut => {
      const { address, tx_hash, output_index, amount } = utxo;
      let ada: Quantity[] = [];
      let assets: Quantity[] = [];

      amount?.forEach((asset: Quantity) => {
        if (asset.unit === "lovelace") {
          ada.push(asset);
          return;
        }
        assets.push(asset);
      });

      const balance: MultiAssetAmount = {
        coin: ada.reduce((total: number, { quantity }: Quantity) => {
          total += Number(quantity);
          return total;
        }, 0),
      };

      if (assets) {
        balance.multi_assets = {};
        assets.forEach(({ quantity, unit }: Quantity) => {
          let policyId = unit.slice(0, 56);
          let tokenName = unit.slice(56);
          if (balance.multi_assets) {
            if (balance.multi_assets[policyId] === undefined) {
              balance.multi_assets[policyId] = {};
            }
            balance.multi_assets[policyId][tokenName] =
              Number(balance.multi_assets?.[policyId]?.[tokenName] ?? 0) + Number(quantity);
          }
        });
      }

      return {
        address,
        tx_hash,
        output_index,
        amount: balance,
      };
    });
    return utxosWithAssets;
  } catch (e) {
    Log.E(e);
  }
  return [];
}
