import { APPROVAL_ACTIONS, BackgroundTransport, WindowMessageType } from "../protocol";

/** How long the page waits for the content script to relay a reply. */
export const INJECTED_REQUEST_TIMEOUT_MS = 60_000;
/** Requests that wait for the user's answer in an approval window get longer. */
export const INJECTED_APPROVAL_TIMEOUT_MS = 10 * 60_000;

type Pending = {
  resolve: (reply: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** Requests awaiting a reply from the content script, by request id. */
const pending = new Map<string, Pending>();
let listening = false;

function onWindowMessage(evt: MessageEvent): void {
  if (evt.source !== window) return;
  const data: unknown = evt.data;
  if (typeof data !== "object" || data === null) return;
  if (!("type" in data) || data.type !== WindowMessageType.FROM_CONTENT_SCRIPT) return;
  if (!("payload" in data) || typeof data.payload !== "object" || data.payload === null) return;
  if (!("id" in data.payload) || typeof data.payload.id !== "string") return;

  const entry = pending.get(data.payload.id);
  if (!entry) return;
  pending.delete(data.payload.id);
  clearTimeout(entry.timer);
  entry.resolve(data.payload);
}

/**
 * Transport for MAIN-world scripts: posts the request to the content script via
 * window.postMessage and resolves the reply carrying the same (random) id. Never
 * rejects; a missing reply resolves as an error reply after the timeout.
 */
export const injectedTransport: BackgroundTransport = (request) => {
  if (!listening) {
    window.addEventListener("message", onWindowMessage);
    listening = true;
  }
  const id = crypto.randomUUID();
  const { promise, resolve } = Promise.withResolvers<unknown>();
  const timer = setTimeout(() => {
    pending.delete(id);
    resolve({ id, ok: false, error: `No reply from background for ${request.action} (timed out)` });
  }, APPROVAL_ACTIONS.has(request.action) ? INJECTED_APPROVAL_TIMEOUT_MS : INJECTED_REQUEST_TIMEOUT_MS);
  pending.set(id, { resolve, timer });
  window.postMessage({ type: WindowMessageType.FROM_INJECTED_SCRIPT, payload: { ...request, id } }, window.origin);
  return promise;
};
