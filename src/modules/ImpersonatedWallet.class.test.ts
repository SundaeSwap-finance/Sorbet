// The CBOR/bech32 encoders are exercised in their own tests; jsdom lacks TextDecoder for cbor-web.
jest.mock("../utils/balance", () => ({ assetsToEncodedBalance: () => "encoded-balance" }));
jest.mock("../utils/utxo", () => ({ utxosToHexArray: () => [] }));
jest.mock("../utils/addresses", () => ({ bech32ToHex: (address: string) => `hex:${address}` }));

import { AnyBackgroundRequest, BackgroundAction, BackgroundTransport } from "../protocol";
import { ImpersonatedWallet } from "./ImpersonatedWallet.class";

const failing: BackgroundTransport = async (request: AnyBackgroundRequest) => ({
  id: request.id,
  ok: false,
  error: `boom: ${request.action}`,
});

const experimentalGetCollateral = async (wallet: ImpersonatedWallet): Promise<unknown> => {
  const fn = wallet.experimental?.getCollateral;
  if (typeof fn !== "function") throw new Error("experimental.getCollateral missing");
  return fn();
};

describe("ImpersonatedWallet error handling", () => {
  const wallet = new ImpersonatedWallet(failing);
  const cases: [string, () => Promise<unknown>, string][] = [
    ["getBalance", () => wallet.getBalance(), BackgroundAction.GET_BALANCE],
    ["getChangeAddress", () => wallet.getChangeAddress(), BackgroundAction.QUERY_WALLET_CONFIG],
    ["getCollateral", () => wallet.getCollateral({ amount: "1" }), BackgroundAction.GET_COLLATERAL],
    ["experimental.getCollateral", () => experimentalGetCollateral(wallet), BackgroundAction.GET_COLLATERAL],
    ["getNetworkId", () => wallet.getNetworkId(), BackgroundAction.QUERY_WALLET_CONFIG],
    ["getUnusedAddresses", () => wallet.getUnusedAddresses(), BackgroundAction.QUERY_WALLET_CONFIG],
    ["getUsedAddresses", () => wallet.getUsedAddresses(), BackgroundAction.GET_USED_ADDRESSES],
    ["getUtxos", () => wallet.getUtxos(), BackgroundAction.GET_UTXOS],
  ];

  it.each(cases)("%s rejects with APIError -2 carrying the background message", async (_name, run, action) => {
    await expect(run()).rejects.toEqual({ code: -2, info: `boom: ${action}` });
  });
});

describe("ImpersonatedWallet refusals", () => {
  const refused: BackgroundTransport = async (request: AnyBackgroundRequest) => ({
    id: request.id,
    ok: false,
    error: "Site https://x.test is not connected",
    refused: true,
  });

  it("maps a refused reply to APIError -3", async () => {
    await expect(new ImpersonatedWallet(refused).getUtxos()).rejects.toEqual({
      code: -3,
      info: "Site https://x.test is not connected",
    });
  });
});

describe("ImpersonatedWallet without an address", () => {
  const noAddress: BackgroundTransport = async (request) => {
    if (request.action === BackgroundAction.QUERY_WALLET_CONFIG) {
      return { id: request.id, ok: true, data: { impersonatedAddress: "", network: null } };
    }
    return { id: request.id, ok: true, data: null };
  };
  const wallet = new ImpersonatedWallet(noAddress);

  it("getNetworkId rejects instead of reporting a network", async () => {
    await expect(wallet.getNetworkId()).rejects.toMatchObject({ code: -2 });
  });
  it("getChangeAddress and getUnusedAddresses reject", async () => {
    await expect(wallet.getChangeAddress()).rejects.toMatchObject({ code: -2 });
    await expect(wallet.getUnusedAddresses()).rejects.toMatchObject({ code: -2 });
  });
});

describe("ImpersonatedWallet methods", () => {
  it("work when destructured and forward getUtxos params on the wallet's transport", async () => {
    const requests: AnyBackgroundRequest[] = [];
    const transport: BackgroundTransport = async (request) => {
      requests.push(request);
      return { id: request.id, ok: true, data: request.action === BackgroundAction.GET_UTXOS ? [] : null };
    };
    const { getUtxos } = new ImpersonatedWallet(transport);
    await expect(getUtxos("5", { page: 1, limit: 2 })).resolves.toEqual([]);
    expect(requests[0]).toMatchObject({ action: BackgroundAction.GET_UTXOS, amount: "5", paginate: { page: 1, limit: 2 } });
  });

  it("getNetworkId works destructured", async () => {
    const transport: BackgroundTransport = async (request) => ({
      id: request.id,
      ok: true,
      data: { impersonatedAddress: "addr_test1", network: 0 },
    });
    const { getNetworkId } = new ImpersonatedWallet(transport);
    await expect(getNetworkId()).resolves.toBe(0);
  });
});
