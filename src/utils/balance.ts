import * as cbor from "cbor-web";
import { Quantity } from "../types";

/**
 * Quantities are u64 and can exceed Number's safe integer range, so they are
 * decimal strings at rest (JSON-safe across the message boundary) and bigints
 * only inside arithmetic and CBOR encoding.
 */
export interface MultiAssetAmount {
  coin: string;
  multi_assets?: { [policyId: string]: { [assetName: string]: string } };
}

export interface MultiAssetOut {
  address: string;
  tx_hash: string;
  output_index: number;
  amount: MultiAssetAmount;
}

const U64_MAX = 2n ** 64n - 1n;

/** Parse a decimal u64 string; throws on anything else. */
export function parseQuantity(value: string): bigint {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
    throw new Error(`Invalid quantity: ${JSON.stringify(value)}`);
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX) {
    throw new Error(`Quantity exceeds u64: ${value}`);
  }
  return parsed;
}

export function computeBalanceFromAmounts(
  addressInfos: { amount: Quantity[] }[]
): MultiAssetAmount {
  return foldAssets(addressInfos.map((ai) => separateAdaFromAssets(ai.amount)));
}

export function foldAssets(allData: { ada: Quantity[]; assets: Quantity[] }[]): MultiAssetAmount {
  const coin = allData.reduce(
    (total, { ada }) => ada.reduce((sum, { quantity }) => sum + parseQuantity(quantity), total),
    0n
  );
  const multiAssets: { [policyId: string]: { [assetName: string]: string } } = {};
  for (const { assets } of allData) {
    for (const { unit, quantity } of assets) {
      const policyId = unit.slice(0, 56);
      const assetName = unit.slice(56);
      const names = (multiAssets[policyId] ??= {});
      names[assetName] = (parseQuantity(names[assetName] ?? "0") + parseQuantity(quantity)).toString();
    }
  }
  const balance: MultiAssetAmount = { coin: coin.toString() };
  if (Object.keys(multiAssets).length > 0) {
    balance.multi_assets = multiAssets;
  }
  return balance;
}

export function separateAdaFromAssets(amount: Quantity[]): {
  ada: Quantity[];
  assets: Quantity[];
} {
  const ada: Quantity[] = [];
  const assets: Quantity[] = [];
  for (const asset of amount) {
    (asset.unit === "lovelace" ? ada : assets).push(asset);
  }
  return { ada, assets };
}

function multiAssetsToCbor(amount: MultiAssetAmount): Map<Buffer, Map<Buffer, bigint>> {
  const encoded = new Map<Buffer, Map<Buffer, bigint>>();
  for (const [policyId, names] of Object.entries(amount.multi_assets ?? {})) {
    const policy = new Map<Buffer, bigint>();
    for (const [assetName, quantity] of Object.entries(names)) {
      policy.set(Buffer.from(assetName, "hex"), parseQuantity(quantity));
    }
    encoded.set(Buffer.from(policyId, "hex"), policy);
  }
  return encoded;
}

/** Output value: bare coin, or [coin, multiasset map] when the amount holds native assets. */
export function amountToCborValue(
  amount: MultiAssetAmount
): bigint | [bigint, Map<Buffer, Map<Buffer, bigint>>] {
  const coin = parseQuantity(amount.coin);
  const multiAssets = multiAssetsToCbor(amount);
  return multiAssets.size === 0 ? coin : [coin, multiAssets];
}

/** Balance value: always [coin, multiasset map], even when the map is empty. */
export function assetsToEncodedBalance(balance: MultiAssetAmount): string {
  return cbor
    .encodeOne([parseQuantity(balance.coin), multiAssetsToCbor(balance)], {
      collapseBigIntegers: true,
      highWaterMark: 65535,
    })
    .toString("hex");
}
