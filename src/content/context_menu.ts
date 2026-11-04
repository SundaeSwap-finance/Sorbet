import {
  BackgroundAction,
  callBackground,
  type BackgroundTransport,
} from "../protocol";
import { Log } from "../utils/log_util";

/** Class of every element Sorbet annotates as an address; the click-away check relies on it. */
export const SORBET_ADDRESS_CLASS_NAME = "sorbet_address";

/** How long the result of an action stays visible in the menu. */
const STATUS_MS = 2500;

/** Only the position and trust of the click are used, so tests need not build a full MouseEvent. */
export type AddressClickEvent = Pick<MouseEvent, "isTrusted" | "clientX" | "clientY">;
export type ShowAddressMenuFn = (address: string, ev: AddressClickEvent, originalLink?: string) => void;

/** Only http(s) links may be followed; anything else (javascript:, data:, ...) is dropped. */
const toFollowableUrl = (link: string | undefined): string | null => {
  if (!link) return null;
  try {
    const url = new URL(link, document.baseURI);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

const createMenuButton = (txt: string, onclick: () => void): HTMLButtonElement => {
  const bgColor = "rgb(59 130 246)",
    bgColorOver = "rgb(79 150 256)";
  const button = document.createElement("button");
  button.textContent = txt;
  // The closed shadow root already hides the buttons from page scripts; this is defense in depth.
  button.addEventListener("click", (e) => {
    if (e.isTrusted) onclick();
  });
  button.style.backgroundColor = bgColor;
  button.style.padding = "4px";
  button.addEventListener("mouseover", () => (button.style.backgroundColor = bgColorOver));
  button.addEventListener("mouseout", () => (button.style.backgroundColor = bgColor));
  return button;
};

let showAddressMenu: ShowAddressMenuFn | null = null;

/**
 * Create the singleton popup context menu (Set Address / Add to Address Book / Follow Original
 * Link) once and return its show function. The menu lives in a closed shadow root, so page
 * scripts can neither reach its buttons nor restyle it. The address it acts on is kept in a
 * closure and never read back from the page, and only trusted (user) clicks open it.
 */
export const createAddressMenu = (transport: BackgroundTransport): ShowAddressMenuFn => {
  if (showAddressMenu) return showAddressMenu;

  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "closed" });
  const addressMenu = document.createElement("div");
  addressMenu.style.position = "absolute";
  addressMenu.style.display = "none";
  addressMenu.style.zIndex = "2147483647";
  addressMenu.style.backgroundColor = "gray";
  addressMenu.style.color = "black";
  addressMenu.style.padding = "6px";
  addressMenu.style.flexDirection = "column";

  let address = "";
  let originalLink: string | null = null;

  // The address the buttons act on, shown inside the shadow root where page CSS cannot fake it.
  const addressLabel = document.createElement("div");
  addressLabel.style.fontFamily = "monospace";
  addressLabel.style.fontSize = "11px";
  addressLabel.style.wordBreak = "break-all";
  addressLabel.style.maxWidth = "320px";
  addressLabel.style.marginBottom = "4px";

  const status = document.createElement("div");
  status.style.display = "none";
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  const showStatus = (text: string) => {
    status.textContent = text;
    status.style.display = "block";
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (status.style.display = "none"), STATUS_MS);
  };

  const withAddress =
    (action: typeof BackgroundAction.CONTEXT_MENU_SET_ADDRESS | typeof BackgroundAction.CONTEXT_MENU_ADD_TO_ADDRESS_BOOK, done: string) =>
    () => {
      const target = address;
      callBackground(transport, action, { address: target }).then(
        () => showStatus(done),
        (e: unknown) => {
          Log.E(e, `${action} failed`);
          showStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      );
    };
  const setAddressButton = createMenuButton(
    "Set Address",
    withAddress(BackgroundAction.CONTEXT_MENU_SET_ADDRESS, "Address set")
  );
  const addToAddressBookButton = createMenuButton(
    "Add to Address Book",
    withAddress(BackgroundAction.CONTEXT_MENU_ADD_TO_ADDRESS_BOOK, "Added to address book")
  );
  const originalLinkButton = createMenuButton("Follow Original Link", () => {
    if (originalLink) document.location.assign(originalLink);
  });
  addressMenu.append(addressLabel, setAddressButton, addToAddressBookButton, originalLinkButton, status);
  root.append(addressMenu);
  (document.body ?? document.documentElement).append(host);

  /** close popup unless the click is on a Sorbet address or inside the menu (retargeted to the host) */
  document.addEventListener("click", (e) => {
    if (e.target === host) return;
    if (e.target instanceof Element && e.target.closest(`.${SORBET_ADDRESS_CLASS_NAME}`)) return;
    addressMenu.style.display = "none";
  });

  showAddressMenu = (a, ev, href) => {
    if (!ev.isTrusted) return;
    const xOffset = Math.max(document.documentElement.scrollLeft, document.body.scrollLeft);
    const yOffset = Math.max(document.documentElement.scrollTop, document.body.scrollTop);
    address = a;
    addressLabel.textContent = a;
    originalLink = toFollowableUrl(href);
    originalLinkButton.style.display = originalLink ? "block" : "none";
    status.style.display = "none";
    addressMenu.style.display = "flex";
    addressMenu.style.top = ev.clientY - 5 + yOffset + "px";
    addressMenu.style.left = ev.clientX + 5 + xOffset + "px";
  };
  return showAddressMenu;
};
