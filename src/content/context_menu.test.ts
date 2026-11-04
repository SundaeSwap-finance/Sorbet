import { BackgroundAction, type AnyBackgroundRequest, type BackgroundTransport } from "../protocol";
import { annotateAddressesInDom } from "./dom_scan";

const ADDRESS = "addr1vx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzers66hrl8";
/** What a real user click looks like to the page's listeners; jsdom cannot dispatch trusted events. */
const trustedClick = { isTrusted: true, clientX: 3, clientY: 4 };

/** click listeners registered on annotated spans and menu buttons, so trusted clicks can be simulated */
const clickListeners = new Map<EventTarget, Array<(e: unknown) => void>>();
const trustedClickOn = (target: EventTarget) =>
  (clickListeners.get(target) ?? []).forEach((listener) => listener(trustedClick));

describe("address context menu (content script)", () => {
  const requests: AnyBackgroundRequest[] = [];
  const transport: BackgroundTransport = async (request) => {
    requests.push(request);
    return { id: request.id, ok: true, data: { address: ADDRESS } };
  };
  const shadowRoots: ShadowRoot[] = [];

  beforeAll(() => {
    const addEventListener = EventTarget.prototype.addEventListener;
    jest.spyOn(EventTarget.prototype, "addEventListener").mockImplementation(function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      const capturable = this instanceof HTMLSpanElement || this instanceof HTMLButtonElement;
      if (type === "click" && capturable && typeof listener === "function") {
        clickListeners.set(this, [...(clickListeners.get(this) ?? []), listener as (e: unknown) => void]);
      }
      addEventListener.call(this, type, listener, options);
    });
    const attachShadow = Element.prototype.attachShadow;
    jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init) {
      const root = attachShadow.call(this, init);
      shadowRoots.push(root);
      return root;
    });
    document.body.innerHTML = `<p id="p">pay ${ADDRESS} now</p><p>addr_not_valid</p>`;
    annotateAddressesInDom(transport);
  });

  const menu = () => shadowRoots[0].firstElementChild as HTMLElement;
  const button = (label: string) =>
    Array.from(shadowRoots[0].querySelectorAll("button")).find((b) => b.textContent === label) as HTMLButtonElement;

  it("annotates only valid addresses", () => {
    const spans = document.querySelectorAll(".sorbet_address");
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe(ADDRESS);
  });

  it("ignores untrusted clicks (jsdom clicks are never trusted)", () => {
    const span = document.querySelector<HTMLElement>(".sorbet_address")!;
    span.click();
    expect(menu().style.display).toBe("none");
  });

  it("acts on the address captured at annotation time, not on page DOM text", () => {
    const span = document.querySelector<HTMLElement>(".sorbet_address")!;
    span.textContent = "addr_test1_forged_by_page";
    trustedClickOn(span);
    expect(menu().style.display).toBe("flex");

    button("Set Address").click(); // untrusted: ignored
    expect(requests).toEqual([]);

    trustedClickOn(button("Set Address"));
    trustedClickOn(button("Add to Address Book"));
    expect(requests.map((r) => [r.action, "address" in r ? r.address : undefined])).toEqual([
      [BackgroundAction.CONTEXT_MENU_SET_ADDRESS, ADDRESS],
      [BackgroundAction.CONTEXT_MENU_ADD_TO_ADDRESS_BOOK, ADDRESS],
    ]);
  });

  it("keeps the menu out of the page's reach (closed shadow root)", () => {
    const host = shadowRoots[0].host as HTMLElement;
    expect(host.shadowRoot).toBeNull();
    expect(document.body.contains(host)).toBe(true);
  });
});
