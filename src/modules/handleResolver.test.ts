import { HandleResolutionError, resolveHandle } from "./handleResolver";

const response = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const reply = (status: number, body: unknown): typeof fetch =>
  (async () => response(status, body)) as unknown as typeof fetch;

describe("resolveHandle", () => {
  it("returns the single holder address", async () => {
    await expect(resolveHandle("alice", "key", reply(200, [{ address: "addr1x" }]))).resolves.toBe("addr1x");
  });

  it("sends the hex-encoded handle and the project key", async () => {
    let seen: { url: string; key: string } | undefined;
    const fetchFn = (async (url: URL, init: RequestInit) => {
      seen = { url: String(url), key: (init.headers as Record<string, string>).project_id };
      return response(200, []);
    }) as unknown as typeof fetch;
    await resolveHandle("ab", "k1", fetchFn).catch(() => undefined);
    expect(seen?.url).toContain("6162/addresses");
    expect(seen?.key).toBe("k1");
  });

  it("rejects on HTTP errors instead of returning the handle", async () => {
    await expect(resolveHandle("alice", "key", reply(403, { error: "x" }))).rejects.toThrow(HandleResolutionError);
  });

  it("rejects on network failures", async () => {
    const failing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await expect(resolveHandle("alice", "key", failing)).rejects.toThrow(/offline/);
  });

  it("rejects unminted, ambiguous and malformed results", async () => {
    await expect(resolveHandle("a", "key", reply(200, []))).rejects.toThrow(/not minted/);
    await expect(resolveHandle("a", "key", reply(200, [{ address: "x" }, { address: "y" }]))).rejects.toThrow(/multiple/);
    await expect(resolveHandle("a", "key", reply(200, [{}]))).rejects.toThrow(/Unexpected/);
  });

  it("requires a mainnet key", async () => {
    await expect(resolveHandle("a", "", reply(200, []))).rejects.toThrow(/API key/);
  });
});
