import {
  PAGE_RELAYABLE_ACTIONS,
  WindowMessageType,
  isBackgroundRequest,
  runtimeTransport,
  type BackgroundReply,
} from "./protocol";

const postReply = (reply: BackgroundReply & { id: string }) => {
  window.postMessage({ type: WindowMessageType.FROM_CONTENT_SCRIPT, payload: reply }, window.origin);
};

const postError = (id: string, error: string) => postReply({ id, ok: false, error });

const requestId = (payload: unknown): string | null =>
  typeof payload === "object" &&
  payload !== null &&
  "id" in payload &&
  typeof payload.id === "string" &&
  payload.id !== ""
    ? payload.id
    : null;

/**
 * Relay one MAIN-world message to the background. Exactly one FROM_CONTENT_SCRIPT reply with the
 * request id is posted: the background's reply, or an error reply for actions a page may not
 * trigger, a missing reply, or chrome.runtime.lastError.
 */
function relayPageMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  const data: unknown = event.data;
  if (typeof data !== "object" || data === null || !("type" in data)) return;
  if (data.type !== WindowMessageType.FROM_INJECTED_SCRIPT) return;

  const payload = "payload" in data ? data.payload : undefined;
  const id = requestId(payload);
  if (id === null) return; // nothing to address a reply to

  if (!isBackgroundRequest(payload) || !PAGE_RELAYABLE_ACTIONS.has(payload.action)) {
    const action =
      typeof payload === "object" && payload !== null && "action" in payload
        ? String(payload.action)
        : "";
    postError(id, `Action not permitted from web pages: ${action}`);
    return;
  }

  // runtimeTransport turns chrome.runtime.lastError into an error reply with this id.
  void runtimeTransport(payload).then((response) => {
    if (typeof response !== "object" || response === null || !("ok" in response)) {
      postError(id, `No reply from background for ${payload.action}`);
      return;
    }
    postReply({ ...(response as BackgroundReply), id });
  });
}

export function installRelay(): void {
  window.addEventListener("message", relayPageMessage);
}
