import { ImpersonatedWallet } from "./modules/ImpersonatedWallet.class";
import { EWalletType } from "./types";
import { isValidAddress } from "./utils/addresses";
import { sendMessageToBackground } from "./utils/sendMessageToBackground";

try {
  window.addEventListener("__sorbet_extensionBaseURL", async (event: CustomEventInit) => {
    const { extensionBaseURL } = event.detail;

    // Check if the window.cardano object exists or create it
    if (typeof window.cardano === "undefined") {
      window.cardano = {};
    }

    // Check if the window.cardano.sorbet object exists or create it
    if (typeof window.cardano.sorbet === "undefined") {
      let { wallet, impersonatedAddress, walletType } = await sendMessageToBackground({
        action: "query_walletConfig",
      });

      if (walletType !== EWalletType.IMPERSONATE && wallet) {
        window.cardano[walletType === EWalletType.OVERRIDE ? wallet : "sorbet"] = {
          apiVersion: "0.1.0",
          icon: `${extensionBaseURL}sorbet.png`,
          name: "Sorbet",
          enable: async function () {
            return window.cardano[wallet].enable();
          },
          isEnabled: async function () {
            return window.cardano[wallet].isEnabled();
          },
          setAddress,
          addToAddressBook,
        };
        {
          walletType === EWalletType.OVERRIDE
            ? console.log(`Sorbet: wallet injected (overriding ${wallet}).`)
            : console.log(`Sorbet: wallet injected (wrapping ${wallet}).`);
        }
      } else if (walletType === EWalletType.IMPERSONATE) {
        try {
          let instance: ImpersonatedWallet;
          window.cardano["sorbet"] = {
            apiVersion: "0.1.0",
            icon: `${extensionBaseURL}sorbet.png`,
            name: "Sorbet",
            enable: async function () {
              instance = new ImpersonatedWallet();
              return instance;
            },
            isEnabled: async function () {
              return instance instanceof ImpersonatedWallet;
            },
            setAddress,
            addToAddressBook,
          };
          console.log(`Sorbet: wallet injected (impersonating: ${impersonatedAddress ?? "no wallet address set"}).`);
        } catch (e) {
          console.error("Sorbet: impersonate wallet initialization error");
          console.log(e);
        }
      } else {
        console.log(`Sorbet: no wallet initiated.`);
      }
    }

    let { shouldScanForAddresses } = await sendMessageToBackground({
      action: "query_shouldScanForAddresses",
    });
    if (shouldScanForAddresses) {
      // artificial delay to wait for js to fully load
      setTimeout(() => {
        annotateAddressesInDom()
      }, 2500)
    } else {
      console.log("Sorbet: address scanning disabled, this can be changed in the extension options")
    }

    console.log("Sorbet: done.");
  });

  const SORBET_ADDRESS_ANNOTATION_CLASSNAME = 'sorbet_address'
  /**  expose Wallet Address setter functionality to the page. Sends a message to background. */
  const setAddress = async function (address: string): Promise<void> {
    await sendMessageToBackground({ action: "setAddress", address })
  }
  /**  expose Add to Address Book functionality to the page. Sends a message to background. */
  const addToAddressBook = async function (address: string): Promise<void> {
    await sendMessageToBackground({ action: "addToAddressBook", address })
  }

  /** create singleton Popup Context Menu to hold buttons, e.g. 'Set Address Button'. 
   * return the showPopup function only. */
  type ShowAddressMenuFn = (a: string, ev: MouseEvent, originalLink?: string) => void
  const createAddressMenu = (): ShowAddressMenuFn => {
    /** create Popup Context Menu Buttons */
    const createMenuButton = (id: string, txt: string, onclick: (e: MouseEvent) => void): HTMLButtonElement => {
      const bgColor = "rgb(59 130 246)", bgColorOver = "rgb(79 150 256)"
      const popupButton = document.createElement('button')
      popupButton.id = id
      popupButton.innerText = txt
      popupButton.onclick = onclick
      popupButton.style.backgroundColor = bgColor
      popupButton.style.padding = "4px"
      popupButton.onmouseover = () => popupButton.style.backgroundColor = bgColorOver
      popupButton.onmouseout = () => popupButton.style.backgroundColor = bgColor
      return popupButton
    }
    let addressMenu: HTMLDivElement, setAddressButton: HTMLButtonElement,
      addToAddressBookButton: HTMLButtonElement, originalLinkButton: HTMLButtonElement
    const ADDRESS_MENU_ID = 'sorbet_address_menu'
    const ADDRESS_MENU_SET_ADDRESS_BUTTON_ID = 'sorbet_address_menu_set_address_button'
    const ADDRESS_MENU_ADD_TO_ADDRESS_BOOK_BUTTON_ID = 'sorbet_address_menu_add_to_addressbook_button'
    const ADDRESS_MENU_ORIGINAL_LINK_BUTTON_ID = 'sorbet_address_menu_original_link_button'
    let foundAddressMenu = document.querySelector("#" + ADDRESS_MENU_ID)
    if (foundAddressMenu) {
      addressMenu = foundAddressMenu as HTMLDivElement
      setAddressButton = addressMenu.children[0] as HTMLButtonElement
      addToAddressBookButton = addressMenu.children[1] as HTMLButtonElement
      originalLinkButton = addressMenu.children[2] as HTMLButtonElement
    } else {
      addressMenu = document.createElement('div')
      addressMenu.id = ADDRESS_MENU_ID
      addressMenu.className = ADDRESS_MENU_ID
      addressMenu.style.position = 'absolute'
      addressMenu.style.display = 'none'
      addressMenu.style.backgroundColor = 'gray'
      addressMenu.style.color = 'black'
      addressMenu.style.padding = '6px'
      document.children[document.children.length - 1].append(addressMenu)
      // Create setAddress Button
      setAddressButton = createMenuButton(ADDRESS_MENU_SET_ADDRESS_BUTTON_ID, "Set Address", (_e) => {
        setAddress(setAddressButton.dataset?.address ?? "")
      })
      addressMenu.appendChild(setAddressButton)
      // Create addToAddressBook Button
      addToAddressBookButton = createMenuButton(ADDRESS_MENU_ADD_TO_ADDRESS_BOOK_BUTTON_ID, "Add to Address Book", (_e) => {
        addToAddressBook(addToAddressBookButton.dataset?.address ?? "")
      })
      addressMenu.appendChild(addToAddressBookButton)
      // Create original link Button
      originalLinkButton = createMenuButton(ADDRESS_MENU_ORIGINAL_LINK_BUTTON_ID, "Follow Original Link", (_e) => {
        if (originalLinkButton.dataset?.originalLink)
          document.location = originalLinkButton.dataset?.originalLink
      })
      addressMenu.appendChild(originalLinkButton)
      /** close popup if event target is neither 1.) a sorbet address link, 2.) one of the address popup buttons */
      document.onclick = e => {
        if (e.target instanceof HTMLElement) {
          if (e.target.className !== SORBET_ADDRESS_ANNOTATION_CLASSNAME
            && e.target.className !== ADDRESS_MENU_SET_ADDRESS_BUTTON_ID
            && e.target.className !== ADDRESS_MENU_ADD_TO_ADDRESS_BOOK_BUTTON_ID
            && e.target.className !== ADDRESS_MENU_ORIGINAL_LINK_BUTTON_ID) {
            addressMenu.style.display = 'none';
          }
        }
      };
    }
    /** Position and show the Set Address popup, 
     * pass the Wallet Address via the element dataset */
    const showAddressMenu: ShowAddressMenuFn = (a, ev, href): void => {
      const xOffset = Math.max(document.documentElement.scrollLeft, document.body.scrollLeft);
      const yOffset = Math.max(document.documentElement.scrollTop, document.body.scrollTop);
      const top = ev.clientY - 5 + yOffset
      const left = ev.clientX + 5 + xOffset
      setAddressButton.dataset.address = a
      addToAddressBookButton.dataset.address = a
      if (href) {
        originalLinkButton.dataset.originalLink = href
        originalLinkButton.style.display = 'block'
      } else {
        originalLinkButton.style.display = 'none'
      }
      addressMenu.style.display = 'flex'
      addressMenu.style.flexDirection = 'column'
      addressMenu.style.top = top + 'px'
      addressMenu.style.left = left + 'px'
    }
    return showAddressMenu
  }

  const SORBET_MENU_CLASS_NAME = 'sorbet_address'
  const annotateAddressesInDom = () => {
    const showAddressMenu = createAddressMenu()
    let totalFound = annotateTextNodes(showAddressMenu)
    totalFound += annotateAnchorNodes(showAddressMenu)
    console.log("Sorbet: finished scanning for wallet addresses. Found ", totalFound, " total addresses")
  }
  /** Add context menu to text nodes containing valid addresses */
  const annotateTextNodes = (showAddressMenu: ShowAddressMenuFn): number => {
    console.log("Sorbet: starting TEXT_NODE scan for wallet addresses..")
    let found = 0
    document.querySelectorAll("div, span, p, b").forEach((d) => {
      const children = Array.prototype.slice.call(d.childNodes)
      const prefixFound = children.find(c => c.nodeValue?.includes("addr")) !== undefined
      if (prefixFound) {
        children.forEach(c => {
          found += splitAndAnnotateTextNode(c, showAddressMenu)
        })
      }
    })
    console.log("Sorbet: found ", found, " TEXT_NODE wallet addresses.")
    return found
  }
  /** Split the text in a text node on empty space and annotate each valid address */
  const splitAndAnnotateTextNode = (c: Element, showAddressMenu: (a: string, ev: MouseEvent, originalLink?: string) => void): number => {
    const nodeVal = c.nodeValue
    if (!nodeVal)
      return 0
    // console.log("splitNodeVal: checking node val", nodeVal)
    let found = 0
    const v = nodeVal.split(/\s|\n/).map((o, _i) => {
      if (isValidAddress(o)) {
        console.log("Sorbet: found address in text node, annotating..", o)
        found++
        const el = document.createElement('span')
        el.className = SORBET_MENU_CLASS_NAME
        el.onclick = (e) => {
          showAddressMenu(o, e)
        }
        el.innerText = o
        return el
      }
      return document.createTextNode(o + " ")
    })
    c.replaceWith(...v)
    return found
  }
  /** Add context menu to anchor nodes containing valid addresses in the href attribute */
  const annotateAnchorNodes = (showAddressMenu: ShowAddressMenuFn): number => {
    let found = 0
    console.log("Sorbet: starting ANCHOR_NODE scan for wallet addresses in href attribute..")
    document.querySelectorAll("a").forEach((c) => {
      if (c instanceof HTMLAnchorElement) {
        const href = c.href
        if (href.includes("addr")) {
          const splitHref = href.split(/\/|#/)
          const o = splitHref.find(h => {
            if (h.startsWith("addr") && isValidAddress(h)) {
              return h
            }
          })
          if (o) {
            console.log("Sorbet: found address in anchor node href attribute, annotating..", o)
            found++
            if (!c.className?.includes(SORBET_MENU_CLASS_NAME))
              c.className = (c.className ? (c.className + " ") : "") + SORBET_MENU_CLASS_NAME
            c.href = ""
            c.onclick = (e) => {
              showAddressMenu(o, e, href)
              e.stopPropagation();
              e.preventDefault();
              return false
            }
          } else {
            // console.log("Sorbet: warning - unable to isolate valid address in href with addr", href)
          }
        }
      }
    })
    console.log("Sorbet: found ", found, " ANCHOR_NODE wallet addresses.")
    return found
  }
} catch (e) {
  console.error("Sorbet: initialization error");
  console.log(e);
}
