import { webcrypto } from "crypto";
import { BackgroundAction, WindowMessageType } from "../protocol";
import {
  INJECTED_APPROVAL_TIMEOUT_MS,
  INJECTED_REQUEST_TIMEOUT_MS,
  injectedTransport,
} from "./sendMessageToBackground";

function reply(id: string, payload: object): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      source: window,
      data: { type: WindowMessageType.FROM_CONTENT_SCRIPT, payload: { id, ...payload } },
    })
  );
}

describe("injectedTransport", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  });
  afterEach(() => jest.useRealTimers());

  it("resolves the reply with the matching id, ignores other ids, and does not mutate the request", async () => {
    const posted: { payload: { id: string } }[] = [];
    jest.spyOn(window, "postMessage").mockImplementation((message: unknown) => {
      posted.push(message as { payload: { id: string } });
    });
    const request = { action: BackgroundAction.PING } as const;
    const promise = injectedTransport(request);
    const id = posted[0].payload.id;
    expect(request).toEqual({ action: BackgroundAction.PING });

    reply("someone-else", { ok: true, data: "forged" });
    reply(id, { ok: true, data: null });
    await expect(promise).resolves.toEqual({ id, ok: true, data: null });
  });

  it("settles as an error reply when nothing answers", async () => {
    jest.spyOn(window, "postMessage").mockImplementation(() => undefined);
    const promise = injectedTransport({ action: BackgroundAction.PING });
    jest.advanceTimersByTime(INJECTED_REQUEST_TIMEOUT_MS);
    await expect(promise).resolves.toMatchObject({ ok: false });
  });

  it("keeps an approval request pending past 60 s, until the approval timeout", async () => {
    jest.spyOn(window, "postMessage").mockImplementation(() => undefined);
    let settled = false;
    const promise = injectedTransport({ action: BackgroundAction.REQUEST_CONNECT });
    void promise.then(() => (settled = true));
    jest.advanceTimersByTime(INJECTED_REQUEST_TIMEOUT_MS + 1000);
    await Promise.resolve();
    expect(settled).toBe(false);
    jest.advanceTimersByTime(INJECTED_APPROVAL_TIMEOUT_MS);
    await expect(promise).resolves.toMatchObject({ ok: false });
  });
});
