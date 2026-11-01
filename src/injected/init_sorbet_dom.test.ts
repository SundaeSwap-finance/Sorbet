// The wallet class pulls in CBOR/WASM dependencies irrelevant to init wiring (and needing TextDecoder).
jest.mock("../modules/ImpersonatedWallet.class", () => ({ ImpersonatedWallet: class {} }));
import { BackgroundAction, type AnyBackgroundRequest, type BackgroundTransport, type InjectionConfig } from "../protocol";
import { EWalletType } from "../types";
import { initSorbetWallet } from "./init_sorbet_dom";

const config = (overrides: Partial<InjectionConfig>): InjectionConfig => ({
  walletType: EWalletType.WRAP,
  wrapWallet: "eternl",
  overrideWallet: null,
  extensionBaseURL: "chrome-extension://x/",
  ...overrides,
});
const transport = async () => undefined;

describe("initSorbetWallet", () => {
  beforeEach(() => {
    window.cardano = {};
  });

  it("override delegates to a wallet assigned after init and does not recurse", async () => {
    expect(
      initSorbetWallet(config({ overrideWallet: "eternl" }), { p2p: false, transport })
    ).toBe(true);
    const sorbet = window.cardano.eternl;
    expect(sorbet.name).toBe("Sorbet");

    const original = { enable: jest.fn(async () => "real"), isEnabled: jest.fn(async () => true) };
    window.cardano.eternl = original;

    expect(window.cardano.eternl).toBe(sorbet);
    await expect(sorbet.enable()).resolves.toBe("real");
    await expect(sorbet.isEnabled()).resolves.toBe(true);
    expect(original.enable).toHaveBeenCalledTimes(1);
  });

  it("enable rejects with an APIError when the wrapped wallet is absent", async () => {
    initSorbetWallet(config({}), { p2p: false, transport });
    await expect(window.cardano.sorbet.enable()).rejects.toMatchObject({ code: -2 });
  });

  it("reports false and installs nothing when there is no wallet to wrap", () => {
    expect(initSorbetWallet(config({ wrapWallet: null }), { p2p: false, transport })).toBe(false);
    expect(window.cardano.sorbet).toBeUndefined();
  });
});

describe("impersonate mode", () => {
  const impersonate = (answer: (request: AnyBackgroundRequest) => unknown): BackgroundTransport => {
    return async (request) => ({ id: request.id, ...(answer(request) as object) });
  };
  const install = (t: BackgroundTransport) => {
    window.cardano = {};
    initSorbetWallet(config({ walletType: EWalletType.IMPERSONATE }), { p2p: false, transport: t });
  };

  it("enable() resolves the same wallet each time once connecting is allowed", async () => {
    install(impersonate(() => ({ ok: true, data: null })));
    const first = await window.cardano.sorbet.enable();
    expect(first).toBeDefined();
    await expect(window.cardano.sorbet.enable()).resolves.toBe(first);
  });

  it("enable() rejects with code -3 when connecting is refused", async () => {
    install(impersonate(() => ({ ok: false, error: "User denied", refused: true })));
    await expect(window.cardano.sorbet.enable()).rejects.toEqual({ code: -3, info: "User denied" });
  });

  it("enable() rejects with code -2 on other failures", async () => {
    install(impersonate(() => ({ ok: false, error: "boom" })));
    await expect(window.cardano.sorbet.enable()).rejects.toEqual({ code: -2, info: "boom" });
  });

  it("isEnabled() follows IS_CONNECTED", async () => {
    let connected = false;
    install(
      impersonate((request) =>
        request.action === BackgroundAction.IS_CONNECTED ? { ok: true, data: connected } : { ok: true, data: null }
      )
    );
    await expect(window.cardano.sorbet.isEnabled()).resolves.toBe(false);
    connected = true;
    await expect(window.cardano.sorbet.isEnabled()).resolves.toBe(true);
  });
});

describe("sorbet stub", () => {
  const loadStub = () => {
    jest.isolateModules(() => {
      require("../sorbet_stub");
    });
  };

  beforeEach(() => {
    window.cardano = {};
  });

  it("enable() rejects with an APIError when init reports failure", async () => {
    loadStub();
    const pending = window.cardano.sorbet.enable();
    window.__sorbet_fail("nothing installed");
    await expect(pending).rejects.toEqual({ code: -2, info: "nothing installed" });
    await expect(window.cardano.sorbet.isEnabled()).resolves.toBe(false);
  });

  it("enable() resolves with the real wallet once patched", async () => {
    loadStub();
    const pending = window.cardano.sorbet.enable();
    window.__sorbet_patch_api(async () => "wallet", async () => true, "icon.png");
    await expect(pending).resolves.toBe("wallet");
    expect(window.cardano.sorbet.icon).toBe("icon.png");
  });
});
