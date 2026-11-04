/** @jest-environment node */
import * as cbor from "cbor-web";
import { assetsToEncodedBalance, computeBalanceFromAmounts, parseQuantity } from "./balance";
import { encodeUtxos, utxosToHexArray } from "./utxo";

const U64_MAX = "18446744073709551615";
const POLICY = "ab".repeat(28);
const ADDRESS = "addr1vx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzers66hrl8";

describe("parseQuantity", () => {
  it("parses u64 decimals", () => {
    expect(parseQuantity(U64_MAX)).toBe(2n ** 64n - 1n);
    expect(parseQuantity("0")).toBe(0n);
  });
  it.each(["1.5", "-1", "abc", "", "18446744073709551616"])("rejects %j", (v) => {
    expect(() => parseQuantity(v)).toThrow();
  });
});

describe("balance encoding", () => {
  it("keeps u64-max quantities exact through fold and CBOR", async () => {
    const balance = computeBalanceFromAmounts([
      { amount: [{ unit: "lovelace", quantity: U64_MAX }, { unit: `${POLICY}01`, quantity: U64_MAX }] },
    ]);
    expect(balance.coin).toBe(U64_MAX);
    expect(balance.multi_assets?.[POLICY]["01"]).toBe(U64_MAX);
    const decoded = await cbor.decodeFirst(Buffer.from(assetsToEncodedBalance(balance), "hex"));
    expect(decoded[0]).toBe(2n ** 64n - 1n);
    expect([...decoded[1].values()][0].values().next().value).toBe(2n ** 64n - 1n);
  });

  it("throws on malformed quantities instead of returning partial results", () => {
    const bad = [{ address: ADDRESS, tx_hash: "aa".repeat(32), output_index: 0, amount: [{ unit: "lovelace", quantity: "1.5" }] }];
    expect(() => encodeUtxos(bad)).toThrow();
    expect(() => computeBalanceFromAmounts([{ amount: [{ unit: "lovelace", quantity: "-1" }] }])).toThrow();
    expect(() =>
      utxosToHexArray([{ address: ADDRESS, tx_hash: "aa".repeat(32), output_index: 0, amount: { coin: "x" } }])
    ).toThrow();
  });

  it("encodes UTxOs with u64-max amounts", async () => {
    const [utxo] = encodeUtxos([
      { address: ADDRESS, tx_hash: "aa".repeat(32), output_index: 1, amount: [{ unit: "lovelace", quantity: U64_MAX }] },
    ]);
    const [hex] = utxosToHexArray([utxo]);
    const decoded = await cbor.decodeFirst(Buffer.from(hex, "hex"));
    expect(decoded[1][1]).toBe(2n ** 64n - 1n);
  });
});
