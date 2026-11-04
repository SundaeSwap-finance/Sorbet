/**
 * Sorbet Stub — injected synchronously at document_start in the MAIN world.
 * Registers window.cardano.sorbet immediately so dApps discover it before
 * any of their own JS runs. The real implementation (injectedScript.js)
 * either patches in enable()/isEnabled()/icon (`__sorbet_patch_api`) or reports
 * that it could not (`__sorbet_fail`). The content script reports a failed script
 * load with a SORBET_LOAD_FAILED window message; if nothing arrives within
 * READY_TIMEOUT_MS, pending and later enable() calls reject. Failures are CIP-30 APIErrors.
 */
import { WindowMessageType } from "./protocol";

const READY_TIMEOUT_MS = 15_000;

type RealApi = {
  enable: () => Promise<unknown>;
  isEnabled: () => Promise<boolean>;
};

(function () {
  if (typeof window.cardano === "undefined") {
    window.cardano = {};
  }

  type State =
    | { status: "pending" }
    | { status: "ready"; api: RealApi }
    | { status: "failed"; error: { code: number; info: string } };
  let state: State = { status: "pending" };
  const waiters: Array<() => void> = [];

  const settle = (next: State) => {
    if (state.status !== "pending") return; // first outcome wins
    state = next;
    clearTimeout(timeout);
    waiters.splice(0).forEach((wake) => wake());
  };

  const fail = (info: string) => settle({ status: "failed", error: { code: -2, info } });

  const timeout = setTimeout(
    () => fail("Sorbet did not finish initializing in time"),
    READY_TIMEOUT_MS
  );

  const whenSettled = (): Promise<void> =>
    state.status !== "pending" ? Promise.resolve() : new Promise((resolve) => waiters.push(resolve));

  // Hold a closure reference so we can mutate properties (e.g. icon) in place,
  // which keeps dApps that captured an early reference in sync with the real impl.
  const stub = {
    apiVersion: "0.1.0",
    name: "Sorbet",
    // Placeholder icon — patched with the real extension URL once available.
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
    enable: async function () {
      await whenSettled();
      if (state.status === "failed") throw state.error;
      if (state.status !== "ready") throw { code: -2, info: "Sorbet is not initialized" };
      return state.api.enable();
    },
    isEnabled: async function () {
      await whenSettled();
      return state.status === "ready" ? state.api.isEnabled() : false;
    },
  };

  // The full script installs the real enable/isEnabled and the icon.
  window.__sorbet_patch_api = (enable, isEnabled, icon) => {
    if (state.status !== "pending") return;
    if (icon) stub.icon = icon;
    settle({ status: "ready", api: { enable, isEnabled } });
  };

  // The full script reports that no wallet will be available.
  window.__sorbet_fail = fail;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data: unknown = event.data;
    if (
      typeof data === "object" &&
      data !== null &&
      "type" in data &&
      data.type === WindowMessageType.SORBET_LOAD_FAILED
    ) {
      const reason = "payload" in data && typeof data.payload === "string" ? data.payload : "";
      fail(reason || "Sorbet failed to load");
    }
  });

  window.cardano.sorbet = stub;
})();
