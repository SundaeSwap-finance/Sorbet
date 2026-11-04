import type { BackgroundTransport } from "../protocol";
import { isValidAddress } from "../utils/addresses";
import { Log } from "../utils/log_util";
import { SORBET_ADDRESS_CLASS_NAME, ShowAddressMenuFn, createAddressMenu } from "./context_menu";

/** Text inside these elements is never annotated. */
const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT"]);
const RESCAN_DEBOUNCE_MS = 300;

/**
 * Annotate valid wallet addresses in the DOM with a context menu, now and whenever the page
 * renders new content. Scanning is idempotent: annotated nodes are skipped. Runs in the
 * content script; menu actions go to the background through `transport`.
 */
export const annotateAddressesInDom = (transport: BackgroundTransport) => {
  const scan = () => scanDom(transport);
  scan();
  let timer: ReturnType<typeof setTimeout> | undefined;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, RESCAN_DEBOUNCE_MS);
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
};

const scanDom = (transport: BackgroundTransport) => {
  Log.App.AddressScan("starting DOM scan for wallet addresses..");
  const showAddressMenu = createAddressMenu(transport);
  const found = annotateTextNodes(showAddressMenu) + annotateAnchorNodes(showAddressMenu);
  Log.App.AddressScan("finished scanning for wallet addresses. Found ", found, " new addresses");
};

const isScannable = (node: Node): boolean => {
  const parent = node.parentElement;
  return (
    parent !== null &&
    !SKIPPED_TAGS.has(parent.tagName) &&
    !parent.isContentEditable &&
    parent.closest(`.${SORBET_ADDRESS_CLASS_NAME}`) === null
  );
};

const makeAddressSpan = (address: string, showAddressMenu: ShowAddressMenuFn): HTMLSpanElement => {
  const el = document.createElement("span");
  el.className = SORBET_ADDRESS_CLASS_NAME;
  el.textContent = address;
  el.addEventListener("click", (e) => showAddressMenu(address, e));
  return el;
};

/** Replace only text nodes that contain a valid address; whitespace and other text are preserved. */
const annotateTextNodes = (showAddressMenu: ShowAddressMenuFn): number => {
  const candidates: Text[] = [];
  const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeValue?.includes("addr") && isScannable(n)) candidates.push(n as Text);
  }
  let found = 0;
  for (const node of candidates) {
    const parts = (node.nodeValue ?? "").split(/(\s+)/);
    if (!parts.some((p) => isValidAddress(p))) continue;
    const replacement = parts.map((part) => {
      if (!isValidAddress(part)) return document.createTextNode(part);
      found++;
      return makeAddressSpan(part, showAddressMenu);
    });
    node.replaceWith(...replacement);
  }
  Log.App.AddressScan("found ", found, " TEXT_NODE wallet addresses.");
  return found;
};

/** Add context menu to anchors whose href contains a valid address; the href is left intact. */
const annotateAnchorNodes = (showAddressMenu: ShowAddressMenuFn): number => {
  let found = 0;
  document.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.href;
    if (!href.includes("addr") || anchor.classList.contains(SORBET_ADDRESS_CLASS_NAME)) return;
    const address = href.split(/[/#?]/).find((segment) => isValidAddress(segment));
    if (!address) return;
    found++;
    anchor.classList.add(SORBET_ADDRESS_CLASS_NAME);
    anchor.addEventListener("click", (e) => {
      showAddressMenu(address, e, anchor.href);
      e.stopPropagation();
      e.preventDefault();
    });
  });
  Log.App.AddressScan("found ", found, " ANCHOR_NODE wallet addresses.");
  return found;
};
