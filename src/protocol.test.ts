import {
  BackgroundAction,
  BackgroundError,
  PageMessageAction,
  callBackground,
  isBackgroundRequest,
  runtimeTransport,
  unwrapReply,
} from "./protocol";

describe("unwrapReply", () => {
  it("turns an error reply into a BackgroundError carrying the background's message", () => {
    const unwrap = () =>
      unwrapReply(BackgroundAction.GET_BALANCE, { id: "1", ok: false, error: "No impersonated address set" });

    expect(unwrap).toThrow(BackgroundError);
    expect(unwrap).toThrow("No impersonated address set");
  });

  it("treats a missing reply as a failure instead of as data", () => {
    expect(() => unwrapReply(BackgroundAction.GET_UTXOS, undefined)).toThrow("No reply from background");
  });

  it("rejects replies without the envelope, e.g. a bare legacy { balance } object", () => {
    expect(() => unwrapReply(BackgroundAction.GET_BALANCE, { balance: { coin: "1" } })).toThrow(
      "Malformed reply from background"
    );
  });
});

describe("isBackgroundRequest", () => {
  it("accepts background actions and rejects page-to-page and unknown actions", () => {
    expect(isBackgroundRequest({ action: BackgroundAction.GET_BALANCE })).toBe(true);
    expect(isBackgroundRequest({ action: PageMessageAction.P2P_POPUP_EXISTS })).toBe(false);
    expect(isBackgroundRequest({ action: "deleteEverything" })).toBe(false);
    expect(isBackgroundRequest(null)).toBe(false);
  });
});

describe("runtimeTransport", () => {
  it("fails the call when no extension context answers, instead of hanging", async () => {
    await expect(callBackground(runtimeTransport, BackgroundAction.QUERY_WALLET_CONFIG, {})).rejects.toThrow(
      "Receiving end does not exist"
    );
  });
});
