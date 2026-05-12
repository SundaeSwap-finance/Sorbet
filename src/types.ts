export enum EView {
  WALLET = "wallet",
  CONTACTS = "contacts",
  CONNECT = "connect",
  TOOLS = "tools",
  SETTINGS = "settings",
}

export enum EWalletType {
  OVERRIDE = "override",
  WRAP = "wrap",
  IMPERSONATE = "impersonate",
}

/** Address Book */
export type AddressBookItem = {
  name?: string;
  address: string;
};

export type AddressBook = AddressBookItem[];
