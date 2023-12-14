import { isValidAddress } from "./components/address-book";
import { ImpersonatedWallet } from "./modules/ImpersonatedWallet.class";
import { EWalletType } from "./types";
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
        };
        {
          walletType === EWalletType.OVERRIDE
            ? console.log(`Sorbet: wallet injected (overriding ${wallet}).`)
            : console.log(`Sorbet: wallet injected (wrapping ${wallet}).`);
        }
      } else if (walletType === EWalletType.IMPERSONATE && impersonatedAddress) {
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
          };
          console.log(`Sorbet: wallet injected (impersonating ${impersonatedAddress}).`);
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
  /** create singleton Popup to hold 'Set Address Button'. 
   * return the showPopup function only. */
  const createAddressPopup = (): (a: string, ev: MouseEvent) => void => {
    let setAddressButton: HTMLButtonElement, addressMenu: HTMLDivElement
    const ADDRESS_MENU_ID = 'sorbet_address_menu'
    const ADDRESS_MENU_BUTTON_ID = 'sorbet_address_menu_button'
    let foundAddressMenu = document.querySelector("#" + ADDRESS_MENU_ID)
    if (foundAddressMenu) {
      addressMenu = foundAddressMenu as HTMLDivElement
      setAddressButton = addressMenu.children[0] as HTMLButtonElement
    } else {
      addressMenu = document.createElement('div')
      addressMenu.id = ADDRESS_MENU_ID
      addressMenu.className = 'sorbet_address_menu'
      addressMenu.style.position = 'absolute'
      addressMenu.style.display = 'none'
      addressMenu.style.backgroundColor = 'gray'
      addressMenu.style.color = 'black'
      addressMenu.style.padding = '6px'
      document.children[document.children.length - 1].append(addressMenu)
      // Create setAddress Button
      setAddressButton = document.createElement('button')
      setAddressButton.id = ADDRESS_MENU_BUTTON_ID
      setAddressButton.innerText = "Set Address"
      setAddressButton.style.backgroundColor = "rgb(59 130 246)"
      setAddressButton.style.padding = "4px"
      setAddressButton.onclick = (_e) => {
        setAddress(setAddressButton.dataset?.address ?? "")
      }
      addressMenu.appendChild(setAddressButton)
      /** close popup if event target is neither 1.) a sorbet address link, 2.) the 'set address button' */
      document.onclick = e => {
        if (e.target instanceof HTMLElement) {
          if (e.target.className !== SORBET_ADDRESS_ANNOTATION_CLASSNAME
            && e.target.className !== ADDRESS_MENU_BUTTON_ID) {
            addressMenu.style.display = 'none';
          }
        }
      };
    }
    /** Position and show the Set Address popup, 
     * pass the Wallet Address via the element dataset */
    const showAddressMenu = (a: string, ev: MouseEvent): void => {
      const xOffset = Math.max(document.documentElement.scrollLeft, document.body.scrollLeft);
      const yOffset = Math.max(document.documentElement.scrollTop, document.body.scrollTop);
      const top = ev.clientY - 5 + yOffset
      const left = ev.clientX + 5 + xOffset
      setAddressButton.dataset.address = a
      addressMenu.style.display = 'block'
      addressMenu.style.top = top + 'px'
      addressMenu.style.left = left + 'px'
    }
    return showAddressMenu
  }
  const annotateAddressesInDom = () => {
    console.log("Sorbet: starting scan for wallet addresses..")
    const showAddressMenu = createAddressPopup()
    let found = 0
    document.querySelectorAll("div, span").forEach((d) => {
      if (d.childNodes[0]?.nodeValue?.includes("addr")) {
        const splitNodeVal = d.childNodes[0].nodeValue.split(" ").reduce((arr, o, _i) => {
          if (isValidAddress(o)) {
            console.log("Sorbet: found address in page, annotating..", o)
            found++
            const el = document.createElement('span')
            el.className = 'sorbet_address'
            el.onclick = (e) => {
              showAddressMenu(o, e)
            }
            el.innerText = o
            arr.push(el)
          } else {
            const el = document.createTextNode(o + " ")
            arr.push(el)
          }
          return arr
        }, [] as Node[])
        d.childNodes[0].remove()
        d.append(...splitNodeVal)
      }
    })
    console.log("Sorbet: finished scanning for wallet addresses. Found ", found, " addresses")
  }
} catch (e) {
  console.error("Sorbet: initialization error");
  console.log(e);
}
