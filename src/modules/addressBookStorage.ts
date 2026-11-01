import { AddressBook, AddressBookItem } from "../types";
import { createSerialQueue, onStorageChanged, storageGet, storageSet } from "../utils/storage";

const ADDRESS_BOOK_KEY = "addressBook";

const enqueue = createSerialQueue();

/**
 * Parse a stored address book once at the boundary. Legacy entries were plain address
 * strings; entries without a string address are dropped; `name` is kept only when a string.
 * Always returns a fresh array.
 */
const parseAddressBook = (raw: unknown): AddressBook => {
  if (!Array.isArray(raw)) return [];
  const book: AddressBook = [];
  for (const entry of raw as unknown[]) {
    if (typeof entry === "string") {
      book.push({ address: entry });
    } else if (typeof entry === "object" && entry !== null) {
      const { address, name } = entry as { address?: unknown; name?: unknown };
      if (typeof address !== "string") continue;
      book.push(typeof name === "string" ? { address, name } : { address });
    }
  }
  return book;
};

export const loadAddressBook = async (): Promise<AddressBook> =>
  parseAddressBook((await storageGet("sync", [ADDRESS_BOOK_KEY]))[ADDRESS_BOOK_KEY]);

/** Serialized read-modify-write. A `null` result from `update` means "no change". */
const modify = (update: (book: AddressBook) => AddressBook | null): Promise<AddressBook> =>
  enqueue(async () => {
    const book = await loadAddressBook();
    const next = update(book);
    if (next === null) return book;
    await storageSet("sync", { [ADDRESS_BOOK_KEY]: next });
    return next;
  });

/** Add an address; no-op when already present (an existing entry is never changed). */
export const addAddress = (address: string): Promise<AddressBook> =>
  modify((book) =>
    book.some((entry) => entry.address === address) ? null : [...book, { address }]
  );

/** Insert the item, or merge it into the existing entry with the same address. */
export const upsertAddressBookItem = (item: AddressBookItem): Promise<AddressBook> =>
  modify((book) =>
    book.some((entry) => entry.address === item.address)
      ? book.map((entry) => (entry.address === item.address ? { ...entry, ...item } : entry))
      : [...book, item]
  );

export const removeAddress = (address: string): Promise<AddressBook> =>
  modify((book) => book.filter((entry) => entry.address !== address));

/** Subscribe to address book changes (any context). Returns the unsubscribe function. */
export const onAddressBookChanged = (listener: (book: AddressBook) => void): (() => void) =>
  onStorageChanged("sync", [ADDRESS_BOOK_KEY], (changes) =>
    listener(parseAddressBook(changes[ADDRESS_BOOK_KEY]?.newValue))
  );
