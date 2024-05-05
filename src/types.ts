export enum EView {
  DEBUG = "debug",
  OVERRIDE = "override",
  ADDRESS_BOOK = "addressbook",
  LOG_VIEWER = "logviewer",
}

export enum EWalletType {
  OVERRIDE = "override",
  WRAP = "wrap",
  IMPERSONATE = "impersonate",
}

/** Address Book */
export type AddressBookItem = { 
  name?: string, 
  address: string 
}

export type AddressBook = AddressBookItem[]