import * as cbor from "cbor-web";
import { UTxO } from "../types";
import { bech32ToHex } from "./addresses";
import { MultiAssetOut, amountToCborValue, foldAssets, separateAdaFromAssets } from "./balance";
import { Log } from "./log_util";

/**
 * CBOR-encode UTxOs. An entry with an unusable address or tx_hash is skipped with a
 * warning; any other failure (e.g. a malformed quantity) throws.
 */
export function utxosToHexArray(utxos: MultiAssetOut[]): string[] {
  const encoded: string[] = [];
  for (const utxo of utxos) {
    let addressBytes: Buffer;
    let txHash: Buffer;
    try {
      if (!utxo.address || !/^([0-9a-fA-F]{2})+$/.test(utxo.tx_hash)) {
        throw new Error("missing address or malformed tx_hash");
      }
      addressBytes = Buffer.from(bech32ToHex(utxo.address), "hex");
      txHash = Buffer.from(utxo.tx_hash, "hex");
    } catch (e) {
      Log.W(`Skipping UTxO ${utxo.tx_hash}#${utxo.output_index}: unusable address or tx_hash`, e);
      continue;
    }

    encoded.push(
      cbor
        .encodeOne(
          [
            [txHash, utxo.output_index],
            [addressBytes, amountToCborValue(utxo.amount)],
          ],
          { collapseBigIntegers: true, highWaterMark: 65535 }
        )
        .toString("hex")
    );
  }
  return encoded;
}

/** Convert Blockfrost unit/quantity UTxOs to coin/multiasset form. Throws on a malformed quantity. */
export function encodeUtxos(utxos: UTxO[]): MultiAssetOut[] {
  return utxos.map(({ address, tx_hash, output_index, amount }) => ({
    address,
    tx_hash,
    output_index,
    amount: foldAssets([separateAdaFromAssets(amount)]),
  }));
}
