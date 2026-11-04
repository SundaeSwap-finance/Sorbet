import { failNextStorageOperation, getStorageData, setStorageData } from "../test/chromeMock";
import {
  addAddress,
  loadAddressBook,
  onAddressBookChanged,
  removeAddress,
  upsertAddressBookItem,
} from "./addressBookStorage";

describe("addressBookStorage", () => {
  it("keeps an existing name when the address is added again", async () => {
    await upsertAddressBookItem({ address: "addr1", name: "Alice" });
    await addAddress("addr1");
    expect(await loadAddressBook()).toEqual([{ address: "addr1", name: "Alice" }]);
  });

  it("merges upserts into the existing entry", async () => {
    await upsertAddressBookItem({ address: "addr1", name: "Alice" });
    await upsertAddressBookItem({ address: "addr1" });
    expect(await loadAddressBook()).toEqual([{ address: "addr1", name: "Alice" }]);
  });

  it("persists two concurrent adds", async () => {
    await Promise.all([addAddress("addr1"), addAddress("addr2")]);
    expect((await loadAddressBook()).map((e) => e.address)).toEqual(["addr1", "addr2"]);
  });

  it("rejects a failed write without notifying listeners", async () => {
    const listener = jest.fn();
    const unsubscribe = onAddressBookChanged(listener);
    failNextStorageOperation("sync");
    await expect(addAddress("addr1")).rejects.toThrow();
    expect(listener).not.toHaveBeenCalled();
    expect(await loadAddressBook()).toEqual([]);
    unsubscribe();
  });

  it("normalizes legacy and invalid stored entries", async () => {
    setStorageData("sync", {
      addressBook: ["addr1", { address: "addr2", name: "Bob" }, { name: "no address" }, { address: "addr3", name: 5 }, 7, null],
    });
    expect(await loadAddressBook()).toEqual([
      { address: "addr1" },
      { address: "addr2", name: "Bob" },
      { address: "addr3" },
    ]);
  });

  it("does not share the empty fallback between reads", async () => {
    const first = await loadAddressBook();
    first.push({ address: "ghost" });
    expect(await loadAddressBook()).toEqual([]);
    await addAddress("real");
    expect(getStorageData("sync").addressBook).toEqual([{ address: "real" }]);
  });

  it("removes an address", async () => {
    await addAddress("addr1");
    expect(await removeAddress("addr1")).toEqual([]);
  });
});
