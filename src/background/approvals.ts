import { APPROVAL_KEEPALIVE_PORT, ApprovalDecision, ApprovalKind, ApprovalRequest } from "../protocol";
import { Log } from "../utils/log_util";

/** The user (or the site's own behaviour) ruled the request out; replied with `refused: true`. */
export class RefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefusedError";
  }
}

/** After a deny or a closed window, the same origin is not prompted again (per kind group) for this long. */
const COOLDOWN_MS = 30_000;

/** Connect approvals and hooks approvals (setAddress / addToAddressBook) are limited independently. */
type Group = "connect" | "hooks";
const groupOf = (kind: ApprovalKind): Group => (kind === "connect" ? "connect" : "hooks");
const groupKey = (origin: string, group: Group) => `${group} ${origin}`;

interface Pending {
  request: ApprovalRequest;
  windowId: number | undefined;
  /** Settles the shared decision; every waiter sees the same one. */
  settle: (decision: ApprovalDecision) => void;
}

const pendingById = new Map<string, Pending>();
/** The pending approval per group+origin, with the shared decision promise. */
const pendingByGroup = new Map<string, { id: string; decision: Promise<ApprovalDecision> }>();
const cooldownUntil = new Map<string, number>();
let nextApprovalNumber = 1;

function settlePending(id: string, decision: ApprovalDecision): void {
  const pending = pendingById.get(id);
  if (!pending) return;
  pendingById.delete(id);
  const { origin, kind } = pending.request;
  const key = groupKey(origin, groupOf(kind));
  pendingByGroup.delete(key);
  if (decision === "deny") cooldownUntil.set(key, Date.now() + COOLDOWN_MS);
  pending.settle(decision);
}

/**
 * Ask the user, in a popup window, whether `origin` may do `kind`. Concurrent connect requests
 * from one origin share one approval. Throws RefusedError at once while a hooks approval of the
 * origin is pending, or within the cooldown after a deny/close. Closing the window is a deny.
 */
export function requestApproval(origin: string, kind: ApprovalKind, address?: string): Promise<ApprovalDecision> {
  const group = groupOf(kind);
  const key = groupKey(origin, group);
  const existing = pendingByGroup.get(key);
  if (existing) {
    if (group === "connect") return existing.decision;
    return Promise.reject(new RefusedError(`${origin} already has an approval waiting`));
  }
  const until = cooldownUntil.get(key);
  if (until !== undefined && Date.now() < until) {
    return Promise.reject(new RefusedError(`${origin} was denied recently; try again later`));
  }
  cooldownUntil.delete(key);

  const id = `${Date.now().toString(36)}-${nextApprovalNumber++}`;
  const request: ApprovalRequest = { id, origin, kind, ...(address === undefined ? {} : { address }) };
  const { promise, resolve } = Promise.withResolvers<ApprovalDecision>();
  pendingById.set(id, { request, windowId: undefined, settle: resolve });
  pendingByGroup.set(key, { id, decision: promise });

  chrome.windows
    .create({
      url: chrome.runtime.getURL("approve.html#" + id),
      type: "popup",
      width: 400,
      height: 560,
      focused: true,
    })
    .then((created) => {
      if (created?.id === undefined) throw new Error("Approval window has no id");
      const pending = pendingById.get(id);
      if (pending) pending.windowId = created.id;
      else void closeWindow(created.id);
    })
    .catch((err) => {
      Log.W("Sorbet: could not open the approval window", err);
      settlePending(id, "deny");
    });
  return promise;
}

async function closeWindow(windowId: number): Promise<void> {
  try {
    await chrome.windows.remove(windowId);
  } catch (err) {
    Log.W("Sorbet: could not close the approval window", err);
  }
}

/** APPROVAL_GET: the pending approval for the approval window. */
export function getApproval(approvalId: string): ApprovalRequest {
  const pending = pendingById.get(approvalId);
  if (!pending) throw new Error("This approval request has expired");
  return pending.request;
}

/** APPROVAL_DECIDE: settle the approval and close its window. */
export function decideApproval(approvalId: string, decision: ApprovalDecision): void {
  const pending = pendingById.get(approvalId);
  if (!pending) throw new Error("This approval request has expired");
  if (pending.request.kind === "connect" && decision === "allow_once") {
    throw new Error("A connection can only be allowed always or denied");
  }
  const { windowId } = pending;
  settlePending(approvalId, decision);
  if (windowId !== undefined) void closeWindow(windowId);
}

// Event listeners must be registered synchronously at module top level (MV3).
chrome.windows.onRemoved.addListener((windowId) => {
  for (const [id, pending] of pendingById) {
    if (pending.windowId === windowId) settlePending(id, "deny");
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== APPROVAL_KEEPALIVE_PORT) return;
  // Receiving messages is what keeps the service worker alive; their content is irrelevant.
  port.onMessage.addListener(() => {});
});
