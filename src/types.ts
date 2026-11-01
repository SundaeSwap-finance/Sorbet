export enum EView {
  WALLET = "wallet",
  CONTACTS = "contacts",
  CONNECT = "connect",
  TOOLS = "tools",
  SETTINGS = "settings",
}

/**
 * How window.cardano.sorbet behaves. Replacing another wallet is orthogonal and
 * lives in the `overrideWallet` setting, not here.
 */
export enum EWalletType {
  WRAP = "wrap",
  IMPERSONATE = "impersonate",
}

/** Keys of window.cardano that Sorbet can wrap or override. */
export const WALLET_IDS = [
  "begin",
  "eternl",
  "nami",
  "typhoncip30",
  "yoroi",
  "lace",
  "flint",
  "vespr",
] as const;
export type WalletId = (typeof WALLET_IDS)[number];

export const isWalletId = (value: unknown): value is WalletId =>
  typeof value === "string" && (WALLET_IDS as readonly string[]).includes(value);

/** CIP-30 network id: 0 = testnet, 1 = mainnet. */
export type NetworkId = 0 | 1;

/** Blockfrost-style UTxO: unit/quantity tuples. Also the shape of custom (mock) UTxOs. */
export interface UTxO {
  address: string;
  tx_hash: string;
  output_index: number;
  amount: Quantity[];
}

/** Blockfrost-style asset amount. `quantity` is a non-negative decimal integer string (u64). */
export interface Quantity {
  unit: string;
  quantity: string;
}

/** Address Book */
export type AddressBookItem = {
  name?: string;
  address: string;
};

export type AddressBook = AddressBookItem[];
