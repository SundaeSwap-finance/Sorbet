import * as cbor from "cbor-web";
import { Quantity } from "../background";
import { MultiAssetAmount } from "./utxo";

export function computeBalanceFromQuantities(addressInfos: { amount: Quantity[] }[]) {
  const allData = addressInfos.map((ai) => separateAdaFromAssets(ai.amount));
  // We fold all the asset data up into a single array.
  const balance = foldAssets(allData);
  return balance;
}

export function foldAssets(allData: { ada: Quantity[]; assets: Quantity[] }[]) {
  return allData.reduce((acc, { ada, assets }) => {
    acc.coin = (
      Number(acc.coin ?? 0) +
      ada.reduce((total, { quantity }) => {
        total += Number(quantity);
        return total;
      }, 0)
    ).toString();

    if (assets) {
      if (!acc.multi_assets) {
        acc.multi_assets = {};
      }

      assets.forEach(({ quantity, unit }) => {
        if (!acc.multi_assets) {
          acc.multi_assets = {};
        }
        let policyId = unit.slice(0, 56);
        let tokenName = unit.slice(56);
        if (acc.multi_assets[policyId] === undefined) {
          acc.multi_assets[policyId] = {};
        }
        acc.multi_assets[policyId][tokenName] =
          Number(acc.multi_assets?.[policyId]?.[tokenName] ?? 0) + Number(quantity);
      });
    }

    return acc;
  }, {} as MultiAssetAmount<string>);
}

export function separateAdaFromAssets(amount?: Quantity[]): {
  ada: Quantity[];
  assets: Quantity[];
} {
  let ada: Quantity[] = [];
  let assets: Quantity[] = [];

  amount?.forEach((asset) => {
    if (asset.unit === "lovelace") {
      ada.push(asset);
      return;
    }
    assets.push(asset);
  });
  return { ada, assets };
}

export function assetsToEncodedBalance(balance: MultiAssetAmount<any>) {
  // rencode the multiassets to a map of buffers, parsing hex keys on the object to byte buffers
  let multiAsset = new Map<Buffer, Map<Buffer, bigint>>();
  let internedKeys: { [key: string]: Buffer } = {};
  const multi_assets = balance.multi_assets ?? {};
  const allPolicyIds = Object.keys(multi_assets);
  for (const policyId of allPolicyIds) {
    const allAssetNames = Object.keys(multi_assets[policyId]);
    for (const assetName of allAssetNames) {
      const asset = multi_assets[policyId][assetName];
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
  const encoded = cbor
    .encodeOne([BigInt(balance.coin), multiAsset], {
      collapseBigIntegers: true,
      highWaterMark: 65535,
    })
    .toString("hex");
  return encoded;
}
