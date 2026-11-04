import { getStorageData, setStorageData } from "../test/chromeMock";
import {
  appendWalletLog,
  getWalletLogScrollback,
  parseWalletLogScrollback,
  retrieveWalletLogs,
  saveWalletLogScrollback,
} from "./walletLogStorageHandler";

const entry = (created: number, methodName = "getBalance") => ({
  methodName,
  args: [],
  result: "00",
  created,
});

describe("appendWalletLog", () => {
  it("keeps both entries of two concurrent appends", async () => {
    await Promise.all([appendWalletLog(entry(1)), appendWalletLog(entry(2))]);
    const logs = await retrieveWalletLogs();
    expect(logs.map((l) => l.created)).toEqual([1, 2]);
  });

  it.each([
    ["non-object", "nope"],
    ["missing method", { args: [], result: 1, created: 1 }],
    ["non-array args", { methodName: "x", args: {}, result: 1, created: 1 }],
    ["bad created", { methodName: "x", args: [], result: 1, created: "now" }],
    ["oversized", { methodName: "x", args: ["a".repeat(200_000)], result: 1, created: 1 }],
  ])("rejects %s without storing it", async (_name, bad) => {
    await expect(appendWalletLog(bad)).rejects.toThrow(Error);
    expect(getStorageData("local").walletLogs).toBeUndefined();
  });

  it("trims to the newest entries at write time", async () => {
    setStorageData("local", { walletLogScrollback: 2 });
    for (const created of [1, 2, 3]) await appendWalletLog(entry(created));
    const stored = getStorageData("local").walletLogs as { created: number }[];
    expect(stored.map((l) => l.created)).toEqual([2, 3]);
  });

  it("drops the oldest entries once the stored logs exceed 2,000,000 characters", async () => {
    setStorageData("local", { walletLogScrollback: 1000 });
    const big = (created: number) => ({ ...entry(created), args: ["a".repeat(90_000)] });
    for (let created = 1; created <= 30; created++) await appendWalletLog(big(created));
    const stored = getStorageData("local").walletLogs as { created: number }[];
    expect(JSON.stringify(stored).length).toBeLessThanOrEqual(2_000_000);
    expect(stored.length).toBeLessThan(30);
    expect(stored[stored.length - 1].created).toBe(30);
    expect(stored.map((l) => l.created)).toEqual(
      Array.from({ length: stored.length }, (_, i) => 30 - stored.length + 1 + i)
    );
  });

  it("keeps a string origin and rejects other types", async () => {
    await appendWalletLog({ ...entry(1), origin: "https://a.example" });
    expect((await retrieveWalletLogs())[0].origin).toBe("https://a.example");
    await expect(appendWalletLog({ ...entry(2), origin: 5 })).rejects.toThrow(Error);
  });
});

describe("scrollback", () => {
  it.each([
    [NaN, 30],
    ["abc", 30],
    ["", 30],
    [1.5, 30],
    [-4, 1],
    [0, 1],
    [5000, 1000],
    ["12", 12],
  ])("parses %p to %p", (raw, expected) => {
    expect(parseWalletLogScrollback(raw)).toBe(expected);
  });

  it("saves the clamped value and reads bad persisted data as the default", async () => {
    await expect(saveWalletLogScrollback(-5)).resolves.toBe(1);
    expect(getStorageData("local").walletLogScrollback).toBe(1);
    setStorageData("local", { walletLogScrollback: "junk" });
    await expect(getWalletLogScrollback()).resolves.toBe(30);
  });
});
