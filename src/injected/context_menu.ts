import { setAddress, addToAddressBook } from "./messages"

const SORBET_ADDRESS_ANNOTATION_CLASSNAME = 'sorbet_address'

/** create singleton Popup Context Menu to hold buttons, e.g. 'Set Address Button'. 
 * return the showPopup function only. */
export type ShowAddressMenuFn = (a: string, ev: MouseEvent, originalLink?: string) => void
export const createAddressMenu = (): ShowAddressMenuFn => {
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