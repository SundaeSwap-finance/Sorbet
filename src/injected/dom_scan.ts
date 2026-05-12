import { isValidAddress } from "../utils/addresses";
import { Log } from "../utils/log_util";
import { ShowAddressMenuFn, createAddressMenu } from "./context_menu";

/**
 * Scan the DOM for valid wallet address strings and annotate them with a context menu
 */
const SORBET_MENU_CLASS_NAME = "sorbet_address";
export const annotateAddressesInDom = () => {
  // artificial delay to wait for js to fully load
  setTimeout(() => {
    doAnnotateAddressesInDom();
  }, 2500);
};
export const doAnnotateAddressesInDom = () => {
  Log.App.AddressScan("starting DOM scan for wallet addresses..");
  const showAddressMenu = createAddressMenu();
  let totalFound = annotateTextNodes(showAddressMenu);
  totalFound += annotateAnchorNodes(showAddressMenu);
  Log.App.AddressScan(
    "finished scanning for wallet addresses. Found ",
    totalFound,
    " total addresses"
  );
};
/** Add context menu to text nodes containing valid addresses */
const annotateTextNodes = (showAddressMenu: ShowAddressMenuFn): number => {
  Log.D("starting TEXT_NODE scan for wallet addresses..");
  let found = 0;
  document.querySelectorAll("div, span, p, b").forEach((d) => {
    const children = Array.prototype.slice.call(d.childNodes);
    const prefixFound = children.find((c) => c.nodeValue?.includes("addr")) !== undefined;
    if (prefixFound) {
      children.forEach((c) => {
        found += splitAndAnnotateTextNode(c, showAddressMenu);
      });
    }
  });
  Log.App.AddressScan("found ", found, " TEXT_NODE wallet addresses.");
  return found;
};
/** Split the text in a text node on empty space and annotate each valid address */
const splitAndAnnotateTextNode = (
  c: Element,
  showAddressMenu: (a: string, ev: MouseEvent, originalLink?: string) => void
): number => {
  const nodeVal = c.nodeValue;
  if (!nodeVal) return 0;
  let found = 0;
  const v = nodeVal.split(/\s|\n/).map((o, _i) => {
    if (isValidAddress(o)) {
      Log.D("found address in text node, annotating..", o);
      found++;
      const el = document.createElement("span");
      el.className = SORBET_MENU_CLASS_NAME;
      el.onclick = (e) => {
        showAddressMenu(o, e);
      };
      el.innerText = o;
      return el;
    }
    return document.createTextNode(o + " ");
  });
  c.replaceWith(...v);
  return found;
};
/** Add context menu to anchor nodes containing valid addresses in the href attribute */
const annotateAnchorNodes = (showAddressMenu: ShowAddressMenuFn): number => {
  let found = 0;
  Log.D("starting ANCHOR_NODE scan for wallet addresses in href attribute..");
  document.querySelectorAll("a").forEach((c) => {
    if (c instanceof HTMLAnchorElement) {
      const href = c.href;
      if (href.includes("addr")) {
        const splitHref = href.split(/\/|#/);
        const o = splitHref.find((h) => {
          if (h.startsWith("addr") && isValidAddress(h)) {
            return h;
          }
        });
        if (o) {
          Log.D("found address in anchor node href attribute, annotating..", o);
          found++;
          if (!c.className?.includes(SORBET_MENU_CLASS_NAME))
            c.className = (c.className ? c.className + " " : "") + SORBET_MENU_CLASS_NAME;
          c.href = "";
          c.onclick = (e) => {
            showAddressMenu(o, e, href);
            e.stopPropagation();
            e.preventDefault();
            return false;
          };
        } else {
          // Log.D("warning - unable to isolate valid address in href with addr", href)
        }
      }
    }
  });
  Log.App.AddressScan("found ", found, " ANCHOR_NODE wallet addresses.");
  return found;
};
