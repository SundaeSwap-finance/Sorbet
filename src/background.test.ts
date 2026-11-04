/** @jest-environment node */
import {
  flushChrome,
  getOpenWindows,
  getStorageData,
  sendMessageFrom,
  setStorageData,
  userClosesWindow,
  webPageSender,
} from "./test/chromeMock";

const BASE_ADDRESS =
  "addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x";
const OTHER_ADDRESS =
  "addr1z8phkx6acpnf78fuvxn0mkew3l0fd058hzquvz7w36x4gten0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs9yc0hh";

interface BackgroundReply {
  id?: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  refused?: boolean;
}

const send = (message: Record<string, unknown>): Promise<BackgroundReply> =>
  chrome.runtime.sendMessage({ id: "req-1", ...message }) as Promise<BackgroundReply>;

/** The slice of fetch's Response the background reads. */
const fakeResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  }) as unknown as Response;
const jsonResponse = fakeResponse;

const accountAddresses = (count: number, offset = 0) =>
  Array.from({ length: count }, (_, i) => ({ address: `addr1fake${offset + i}` }));

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.isolateModules(() => {
    require("./background");
  });
  setStorageData("sync", {
    impersonatedAddress: BASE_ADDRESS,
    blockfrostMainnetApiKey: "mainnet-key",
  });
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("background replies", () => {
  it("answers ping with an envelope even though the data is null", async () => {
    expect(await send({ action: "ping" })).toEqual({ id: "req-1", ok: true, data: null });
  });

  it("answers store_walletLog with an envelope and stores the entry", async () => {
    const payload = { methodName: "getBalance", args: [], result: "00", created: 1 };
    expect(await send({ action: "store_walletLog", payload })).toEqual({
      id: "req-1",
      ok: true,
      data: null,
    });
    expect(getStorageData("local").walletLogs).toEqual([payload]);
  });

  it("does not claim p2p_popup_exists", async () => {
    await expect(chrome.runtime.sendMessage({ action: "p2p_popup_exists" })).rejects.toThrow(
      /Receiving end does not exist/
    );
  });

  it("answers an invalid setAddress with an error reply and keeps the old address", async () => {
    const reply = await send({ action: "setAddress", address: "not-an-address" });
    expect(reply).toMatchObject({ id: "req-1", ok: false });
    expect(getStorageData("sync").impersonatedAddress).toBe(BASE_ADDRESS);
  });

  it("stores a valid setAddress before replying", async () => {
    const reply = await send({ action: "setAddress", address: OTHER_ADDRESS });
    expect(reply).toEqual({ id: "req-1", ok: true, data: { address: OTHER_ADDRESS } });
    expect(getStorageData("sync").impersonatedAddress).toBe(OTHER_ADDRESS);
  });
});

describe("Blockfrost data", () => {
  it("serves each used-address page separately", async () => {
    fetchMock.mockImplementation(async (url: URL) =>
      jsonResponse(200, url.searchParams.get("page") === "1" ? accountAddresses(3) : [])
    );
    const first = await send({
      action: "request_getUsedAddresses",
      paginate: { page: 0, limit: 2 },
    });
    const second = await send({
      action: "request_getUsedAddresses",
      paginate: { page: 1, limit: 2 },
    });
    const third = await send({
      action: "request_getUsedAddresses",
      paginate: { page: 2, limit: 2 },
    });
    expect(first.data).toEqual(["addr1fake0", "addr1fake1"]);
    expect(second.data).toEqual(["addr1fake2"]);
    expect(third.data).toEqual([]);
  });

  it("paginates the account address scan past 100 addresses", async () => {
    fetchMock.mockImplementation(async (url: URL) => {
      const page = Number(url.searchParams.get("page"));
      return jsonResponse(
        200,
        page === 1 ? accountAddresses(100) : page === 2 ? accountAddresses(20, 100) : []
      );
    });
    const reply = await send({ action: "request_getUsedAddresses" });
    expect(reply.data).toHaveLength(120);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("answers a Blockfrost 5xx with an error reply and does not cache it", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(500, "boom"));
    const failed = await send({ action: "request_getUsedAddresses" });
    expect(failed).toMatchObject({ id: "req-1", ok: false });
    expect(failed.error).toMatch(/500/);

    fetchMock.mockImplementation(async () => jsonResponse(200, accountAddresses(1)));
    const retried = await send({ action: "request_getUsedAddresses" });
    expect(retried).toEqual({ id: "req-1", ok: true, data: ["addr1fake0"] });
  });

  it("never has more than 8 Blockfrost fetches in flight", async () => {
    // Stake-account address: the UTxO load fans out over every account address.
    let inFlight = 0;
    let maxInFlight = 0;
    const releases: Array<() => void> = [];
    fetchMock.mockImplementation(async (url: URL) => {
      if (url.pathname.includes("/accounts/")) {
        return jsonResponse(200, url.searchParams.get("page") === "1" ? accountAddresses(30) : []);
      }
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise<void>((resolve) => releases.push(resolve));
      inFlight--;
      return jsonResponse(200, []);
    });
    const pending = send({ action: "request_getUTXOs" });
    for (let i = 0; i < 200 && (releases.length < 8 || inFlight < 8); i++) await flushChrome();
    expect(inFlight).toBe(8);
    let done = false;
    void pending.then(() => (done = true));
    while (!done) {
      releases.splice(0).forEach((release) => release());
      await flushChrome();
    }
    expect(maxInFlight).toBe(8);
    expect((await pending).ok).toBe(true);
  });
});

const SITE = "https://dapp.example";
const OTHER_SITE = "https://other.example";

const sendFrom = (origin: string, message: Record<string, unknown>): Promise<BackgroundReply> =>
  sendMessageFrom(webPageSender(origin), { id: "req-1", ...message }) as Promise<BackgroundReply>;

async function waitForWindows(count: number): Promise<void> {
  for (let i = 0; i < 100 && getOpenWindows().length < count; i++) await flushChrome();
  expect(getOpenWindows()).toHaveLength(count);
}

const approvalIdOf = (windowIndex = 0) => getOpenWindows()[windowIndex].url!.split("#")[1];

const decide = (decision: string, windowIndex = 0) =>
  send({ action: "approval_decide", approvalId: approvalIdOf(windowIndex), decision });

const connect = async (origin: string) => {
  const request = sendFrom(origin, { action: "requestConnect" });
  await waitForWindows(1);
  await decide("allow_always");
  await request;
};

describe("web page permissions", () => {
  it.each([
    "query_walletConfig",
    "request_getUsedAddresses",
    "request_getCollateral",
    "request_getBalance",
    "request_getUTXOs",
  ])("refuses %s without the connect permission", async (action) => {
    const reply = await sendFrom(SITE, { action });
    expect(reply).toMatchObject({ id: "req-1", ok: false, refused: true });
    expect(reply.error).toContain(SITE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses wallet logs from an unconnected site and stores nothing", async () => {
    const payload = { methodName: "getBalance", args: [], result: "00", created: 1 };
    const reply = await sendFrom(SITE, { action: "store_walletLog", payload });
    expect(reply).toMatchObject({ ok: false, refused: true });
    expect(getStorageData("local").walletLogs).toBeUndefined();
  });

  it("answers isConnected without prompting", async () => {
    expect(await sendFrom(SITE, { action: "isConnected" })).toEqual({ id: "req-1", ok: true, data: false });
    expect(getOpenWindows()).toHaveLength(0);
    await connect(SITE);
    expect(await sendFrom(SITE, { action: "isConnected" })).toEqual({ id: "req-1", ok: true, data: true });
    expect(await sendFrom(OTHER_SITE, { action: "isConnected" })).toMatchObject({ data: false });
  });

  it("gives a connected site only the address and network", async () => {
    await connect(SITE);
    const reply = await sendFrom(SITE, { action: "query_walletConfig" });
    expect(reply).toEqual({
      id: "req-1",
      ok: true,
      data: { impersonatedAddress: BASE_ADDRESS, network: 1 },
    });
  });

  it("refuses pages without a usable origin", async () => {
    const reply = await sendMessageFrom(
      { ...webPageSender(SITE), origin: undefined, url: "file:///tmp/x.html" },
      { id: "req-1", action: "requestConnect" }
    );
    expect(reply).toMatchObject({ ok: false, refused: true });
    expect(getOpenWindows()).toHaveLength(0);
  });

  it("lets pages read the injection config and ping without permission", async () => {
    expect(await sendFrom(SITE, { action: "ping" })).toMatchObject({ ok: true });
    expect(await sendFrom(SITE, { action: "query_injectionConfig" })).toMatchObject({
      ok: true,
      data: expect.objectContaining({ walletType: expect.any(String) }),
    });
  });

  it.each([
    ["approval_get", { approvalId: "x" }],
    ["approval_decide", { approvalId: "x", decision: "allow_always" }],
  ])("refuses %s from a web page", async (action, params) => {
    const request = sendFrom(SITE, { action: "requestConnect" });
    await waitForWindows(1);
    const reply = await sendFrom(SITE, { action, ...params, approvalId: approvalIdOf() });
    expect(reply).toMatchObject({ ok: false, refused: true });
    expect(getOpenWindows()).toHaveLength(1);
    expect(await sendFrom(SITE, { action: "isConnected" })).toMatchObject({ data: false });
    await decide("deny");
    await request;
  });
});

describe("connect approval", () => {
  it("opens one window for concurrent requests and connects on allow_always", async () => {
    const requests = [
      sendFrom(SITE, { action: "requestConnect" }),
      sendFrom(SITE, { action: "requestConnect" }),
      sendFrom(SITE, { action: "requestConnect" }),
    ];
    await waitForWindows(1);
    await flushChrome();
    expect(getOpenWindows()).toHaveLength(1);
    expect(getOpenWindows()[0].url).toMatch(/^chrome-extension:\/\/test-extension-id\/approve\.html#.+/);

    const shown = await send({ action: "approval_get", approvalId: approvalIdOf() });
    expect(shown).toMatchObject({ ok: true, data: { origin: SITE, kind: "connect" } });

    expect(await decide("allow_always")).toMatchObject({ ok: true });
    for (const reply of await Promise.all(requests)) expect(reply).toMatchObject({ ok: true, data: null });
    expect(getOpenWindows()).toHaveLength(0);
    expect(await sendFrom(SITE, { action: "isConnected" })).toMatchObject({ data: true });
    expect(await sendFrom(SITE, { action: "requestConnect" })).toMatchObject({ ok: true });
    expect(getOpenWindows()).toHaveLength(0);
  });

  it("refuses on deny", async () => {
    const request = sendFrom(SITE, { action: "requestConnect" });
    await waitForWindows(1);
    await decide("deny");
    expect(await request).toMatchObject({ ok: false, refused: true });
    expect(await sendFrom(SITE, { action: "isConnected" })).toMatchObject({ data: false });
  });

  it("refuses when the window is closed and refuses a retry within 30 s without a window", async () => {
    const request = sendFrom(SITE, { action: "requestConnect" });
    await waitForWindows(1);
    userClosesWindow(getOpenWindows()[0].id);
    expect(await request).toMatchObject({ ok: false, refused: true });

    const retry = await sendFrom(SITE, { action: "requestConnect" });
    expect(retry).toMatchObject({ ok: false, refused: true });
    expect(getOpenWindows()).toHaveLength(0);

    // Another site is not affected.
    const other = sendFrom(OTHER_SITE, { action: "requestConnect" });
    await waitForWindows(1);
    await decide("deny");
    await other;
  });

  it("answers an unknown approval id with an error", async () => {
    expect(await send({ action: "approval_decide", approvalId: "nope", decision: "deny" })).toMatchObject({
      ok: false,
    });
  });
});

describe("hooks approval", () => {
  it("allow_once changes the address without granting hooks", async () => {
    const first = sendFrom(SITE, { action: "setAddress", address: OTHER_ADDRESS });
    await waitForWindows(1);
    expect(await send({ action: "approval_get", approvalId: approvalIdOf() })).toMatchObject({
      data: { origin: SITE, kind: "setAddress", address: OTHER_ADDRESS },
    });
    expect(getStorageData("sync").impersonatedAddress).toBe(BASE_ADDRESS);
    await decide("allow_once");
    expect(await first).toEqual({ id: "req-1", ok: true, data: { address: OTHER_ADDRESS } });
    expect(getStorageData("sync").impersonatedAddress).toBe(OTHER_ADDRESS);
    expect(getStorageData("local").sitePermissions).toBeUndefined();

    const second = sendFrom(SITE, { action: "setAddress", address: BASE_ADDRESS });
    await waitForWindows(1);
    await decide("allow_once");
    expect(await second).toMatchObject({ ok: true });
  });

  it("allow_always grants hooks so the next call needs no window", async () => {
    const first = sendFrom(SITE, { action: "setAddress", address: OTHER_ADDRESS });
    await waitForWindows(1);
    await decide("allow_always");
    expect(await first).toMatchObject({ ok: true });

    const second = await sendFrom(SITE, { action: "setAddress", address: BASE_ADDRESS });
    expect(second).toMatchObject({ ok: true, data: { address: BASE_ADDRESS } });
    expect(getOpenWindows()).toHaveLength(0);
    expect(getStorageData("sync").impersonatedAddress).toBe(BASE_ADDRESS);
    // Hooks do not imply wallet access.
    expect(await sendFrom(SITE, { action: "request_getBalance" })).toMatchObject({ refused: true });
  });

  it("refuses on deny and keeps the address", async () => {
    const request = sendFrom(SITE, { action: "setAddress", address: OTHER_ADDRESS });
    await waitForWindows(1);
    await decide("deny");
    expect(await request).toMatchObject({ ok: false, refused: true });
    expect(getStorageData("sync").impersonatedAddress).toBe(BASE_ADDRESS);
  });

  it("refuses a second hooks request while one is pending", async () => {
    const first = sendFrom(SITE, { action: "addToAddressBook", address: OTHER_ADDRESS });
    await waitForWindows(1);
    const second = await sendFrom(SITE, { action: "setAddress", address: OTHER_ADDRESS });
    expect(second).toMatchObject({ ok: false, refused: true });
    expect(getOpenWindows()).toHaveLength(1);
    await decide("deny");
    await first;
  });

  it("errors on an invalid address without opening a window", async () => {
    const reply = await sendFrom(SITE, { action: "setAddress", address: "not-an-address" });
    expect(reply.ok).toBe(false);
    expect(reply.refused).toBeUndefined();
    expect(getOpenWindows()).toHaveLength(0);
  });

  it("lets the context menu set the address without a permission or window", async () => {
    const reply = await sendFrom(SITE, { action: "contextMenu_setAddress", address: OTHER_ADDRESS });
    expect(reply).toMatchObject({ ok: true, data: { address: OTHER_ADDRESS } });
    expect(getStorageData("sync").impersonatedAddress).toBe(OTHER_ADDRESS);
    expect(getOpenWindows()).toHaveLength(0);
  });

  it("does not write storage when the address is unchanged", async () => {
    const writes = jest.spyOn(chrome.storage.sync, "set");
    expect(await send({ action: "setAddress", address: BASE_ADDRESS })).toMatchObject({ ok: true });
    expect(writes).not.toHaveBeenCalled();
    writes.mockRestore();
  });
});

describe("wallet logs from web pages", () => {
  it("stamps the sender origin over a page-claimed one", async () => {
    await connect(SITE);
    const payload = { methodName: "getBalance", args: [], result: "00", created: 1, origin: "https://evil.example" };
    expect(await sendFrom(SITE, { action: "store_walletLog", payload })).toMatchObject({ ok: true });
    expect(getStorageData("local").walletLogs).toEqual([{ ...payload, origin: SITE }]);
  });

  it("omits the origin for extension pages even if the payload claims one", async () => {
    const payload = { methodName: "getBalance", args: [], result: "00", created: 1, origin: SITE };
    await send({ action: "store_walletLog", payload });
    expect(getStorageData("local").walletLogs).toEqual([
      { methodName: "getBalance", args: [], result: "00", created: 1 },
    ]);
  });
});
