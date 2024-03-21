import { AddressBook, AddressBookItem } from "../types"
import { Log } from "../utils/log_util"

const StorageKeys = {
    ADDRESS_BOOK: "addressBook"
}
const EMPTY_ADDRESS_BOOK: AddressBook = []

type AddressBookUpdatedCallback = (addressBook: AddressBook) => void

export const parseAddressBookFromStorage = (result: { addressBook?: AddressBook }): AddressBook | undefined => {
    if (result.addressBook && Array.isArray(result.addressBook)) {
        return result.addressBook.map(e => (
            typeof e === 'string' ? { address: e } as AddressBookItem : e
        ))
    }
    return undefined
}

export const addItemToAddressBook = (newValue: string, addressBookUpdated: AddressBookUpdatedCallback): void => {
    getAddressBook((ab) => {
        const addressBook = ab
        if (addressBook.find(abe => abe.address === newValue))
            return
        addressBook.push({ address: newValue })
        chrome.storage.sync.set({ addressBook }, function () {
            Log.D("new item saved to AddressBook:", addressBook)
            addressBookUpdated(addressBook)
        })
    })
}

export const addOrUpdateItemInAddressBook = (newItem: AddressBookItem, addressBookUpdated: AddressBookUpdatedCallback) => {
    getAddressBook((addressBook) => {
        const found = addressBook.find(abe => abe.address === newItem.address)
        if (!found) {
            // Add new item
            addressBook.push(newItem)
        } else {
            // Item found, update
            addressBook = addressBook.map(abe =>
                abe.address === newItem.address ? newItem : abe
            )
        }
        chrome.storage.sync.set({ addressBook }, function () {
            Log.D(addressBook)
            addressBookUpdated(addressBook)
        })
    })
}


export const deleteFromAddressBook = (valueToRemove: string, addressBookUpdated: AddressBookUpdatedCallback) => {
    getAddressBook((addressBook) => {
        const newAddressBook = addressBook.filter(abe => abe.address !== valueToRemove)
        chrome.storage.sync.set({ addressBook: newAddressBook }, function () {
            Log.D(newAddressBook)
            addressBookUpdated(newAddressBook)
        })
    })
}

function getAddressBook(addressBookRetrieved: (addressBook: AddressBook) => void) {
    chrome.storage.sync.get(
        [StorageKeys.ADDRESS_BOOK],
        (result) => {
            addressBookRetrieved(
                parseAddressBookFromStorage(result) ?? EMPTY_ADDRESS_BOOK
            )
        }
    )
}