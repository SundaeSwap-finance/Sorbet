import { addressNetworkLabel, decisionOptions, originWarning } from "./approvalView";

describe("originWarning", () => {
  it("warns for plain http on a remote host", () => {
    expect(originWarning("http://example.com")).not.toBeNull();
    expect(originWarning("http://192.168.1.5:3000")).not.toBeNull();
  });

  it("does not warn for https or http on localhost", () => {
    expect(originWarning("https://example.com")).toBeNull();
    expect(originWarning("http://localhost:3000")).toBeNull();
    expect(originWarning("http://127.0.0.1:8080")).toBeNull();
    expect(originWarning("http://app.localhost")).toBeNull();
  });

  it("does not treat a lookalike host as localhost", () => {
    expect(originWarning("http://localhost.evil.com")).not.toBeNull();
  });
});

describe("decisionOptions", () => {
  it("offers only connect/cancel for connections, with no one-time allow", () => {
    expect(decisionOptions("connect").map((o) => o.decision)).toEqual(["allow_always", "deny"]);
  });

  it("offers once/always/deny for address hooks", () => {
    for (const kind of ["setAddress", "addToAddressBook"] as const) {
      expect(decisionOptions(kind).map((o) => o.decision)).toEqual(["allow_once", "allow_always", "deny"]);
    }
  });
});

describe("addressNetworkLabel", () => {
  it("is null for things that are not addresses", () => {
    expect(addressNetworkLabel("not-an-address")).toBeNull();
  });
});
