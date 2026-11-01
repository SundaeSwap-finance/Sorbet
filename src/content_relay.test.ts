import { installRelay } from "./content_relay";
import { BackgroundAction, WindowMessageType } from "./protocol";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("content script relay", () => {
  let posted: unknown[];
  let send: jest.Mock;

  beforeAll(() => installRelay());
  beforeEach(() => {
    posted = [];
    jest
      .spyOn(window, "postMessage")
      .mockImplementation((message: unknown) => void posted.push(message));
    send = jest.fn();
    chrome.runtime.sendMessage = send as unknown as typeof chrome.runtime.sendMessage;
  });
  afterEach(() => jest.restoreAllMocks());

  const fromPage = async (payload: unknown) => {
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        data: { type: WindowMessageType.FROM_INJECTED_SCRIPT, payload },
      })
    );
    await flush();
  };

  it("answers non-relayable actions with an error reply carrying the same id, without contacting the background", async () => {
    await fromPage({ action: BackgroundAction.GET_USED_ADDRESSES, id: "1" });
    await fromPage({ action: "p2p_popup_exists", id: "2" });
    await fromPage({ action: "somethingElse", id: "3" });
    expect(send).toHaveBeenCalledTimes(1);
    const replies = posted.map((m) => (m as { payload: { id: string; ok: boolean } }).payload);
    expect(replies.filter((r) => !r.ok).map((r) => r.id)).toEqual(["2", "3"]);
  });

  it("forwards the background reply", async () => {
    send.mockImplementation((_req, cb) => cb({ ok: true, data: ["addr"] }));
    await fromPage({ action: BackgroundAction.GET_USED_ADDRESSES, id: "7" });
    expect(posted).toEqual([
      {
        type: WindowMessageType.FROM_CONTENT_SCRIPT,
        payload: { ok: true, data: ["addr"], id: "7" },
      },
    ]);
  });

  it("replies with an error on chrome.runtime.lastError", async () => {
    send.mockImplementation((_req, cb) => {
      Object.defineProperty(chrome.runtime, "lastError", {
        configurable: true,
        get: () => ({ message: "boom" }),
      });
      cb(undefined);
      Object.defineProperty(chrome.runtime, "lastError", { configurable: true, value: undefined });
    });
    await fromPage({ action: BackgroundAction.GET_BALANCE, id: "9" });
    expect(posted).toEqual([
      {
        type: WindowMessageType.FROM_CONTENT_SCRIPT,
        payload: { id: "9", ok: false, error: "boom" },
      },
    ]);
  });
});
