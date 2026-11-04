import { ConnectionEvent, P2PConnectionMap, hasConnectedPeer, p2pReducer } from "./p2pConnections";

const event = (overrides: Partial<ConnectionEvent> = {}): ConnectionEvent => ({
  connected: true,
  error: false,
  dApp: { name: "dApp", url: "https://dapp.example", address: "peer-a" },
  identicon: "icon",
  ...overrides,
});

describe("p2pReducer", () => {
  it("merges concurrent per-peer updates without losing entries", () => {
    let state: P2PConnectionMap = {};
    state = p2pReducer(state, { type: "seeded", peerId: "peer-a", seed: "seed-a" });
    state = p2pReducer(state, { type: "connected", peerId: "peer-b", event: event() });
    // storage seeds arrive after both peers already exist
    state = p2pReducer(state, { type: "seed", seeds: { "peer-a": "stale", "peer-c": "seed-c" } });
    state = p2pReducer(state, { type: "connected", peerId: "peer-a", event: event() });

    expect(Object.keys(state).sort()).toEqual(["peer-a", "peer-b", "peer-c"]);
    expect(state["peer-a"].seed).toBe("seed-a");
    expect(state["peer-a"].connection.connected).toBe(true);
    expect(state["peer-b"].connection.connected).toBe(true);
    expect(state["peer-c"].seed).toBe("seed-c");
    expect(state["peer-c"].connection.connected).toBe(false);
  });

  it("removal drops only that peer and a late disconnect does not resurrect it", () => {
    let state = p2pReducer({}, { type: "seed", seeds: { "peer-a": "a", "peer-b": "b" } });
    state = p2pReducer(state, { type: "removed", peerId: "peer-a" });
    expect(Object.keys(state)).toEqual(["peer-b"]);

    state = p2pReducer(state, { type: "disconnected", peerId: "peer-a", event: event() });
    expect(Object.keys(state)).toEqual(["peer-b"]);
  });

  it("handles an event without dApp details and keeps the known dApp", () => {
    let state = p2pReducer({}, { type: "connected", peerId: "peer-a", event: event() });
    state = p2pReducer(state, {
      type: "disconnected",
      peerId: "peer-a",
      event: event({ connected: true, dApp: undefined, identicon: null }),
    });
    const { connection } = state["peer-a"];
    expect(connection.connected).toBe(false);
    expect(connection.dApp).toEqual({
      name: "dApp",
      url: "https://dapp.example",
      address: "peer-a",
      identicon: "icon",
    });
  });

  it("reports whether any peer is connected", () => {
    let state = p2pReducer({}, { type: "seed", seeds: { "peer-a": null } });
    expect(hasConnectedPeer(state)).toBe(false);
    state = p2pReducer(state, { type: "connected", peerId: "peer-a", event: event() });
    expect(hasConnectedPeer(state)).toBe(true);
    state = p2pReducer(state, { type: "disconnected", peerId: "peer-a" });
    expect(hasConnectedPeer(state)).toBe(false);
  });

  it("does not mutate the previous state", () => {
    const before = p2pReducer({}, { type: "connected", peerId: "peer-a", event: event() });
    const snapshot = JSON.stringify(before);
    p2pReducer(before, { type: "disconnected", peerId: "peer-a" });
    p2pReducer(before, { type: "removed", peerId: "peer-a" });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
