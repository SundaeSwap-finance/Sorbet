import { loadSettings, onSettingsChanged, saveSettings } from "./settings";
import { failNextStorageOperation, flushChrome, getStorageData, setStorageData } from "./test/chromeMock";
import { EView, EWalletType } from "./types";

describe("settings", () => {
  it("falls back to the legacy blockfrostApiKey only while the mainnet key is empty", async () => {
    setStorageData("sync", { blockfrostApiKey: "legacy" });
    expect((await loadSettings(["blockfrostMainnetApiKey"])).blockfrostMainnetApiKey).toBe("legacy");

    setStorageData("sync", { blockfrostMainnetApiKey: "current" });
    expect((await loadSettings(["blockfrostMainnetApiKey"])).blockfrostMainnetApiKey).toBe("current");
  });

  it("deletes the legacy key when the mainnet key is saved, so the edit sticks", async () => {
    setStorageData("sync", { blockfrostApiKey: "legacy" });

    await saveSettings({ blockfrostMainnetApiKey: "edited" });

    expect((await loadSettings(["blockfrostMainnetApiKey"])).blockfrostMainnetApiKey).toBe("edited");
    expect(getStorageData("sync")).not.toHaveProperty("blockfrostApiKey");
  });

  it("restores current history tabs and maps pre-redesign ones", async () => {
    setStorageData("sync", { historyTab: "contacts" });
    expect((await loadSettings(["historyTab"])).historyTab).toBe(EView.CONTACTS);

    setStorageData("sync", { historyTab: "utxo_builder" });
    expect((await loadSettings(["historyTab"])).historyTab).toBe(EView.TOOLS);

    setStorageData("sync", { historyTab: "no-such-tab" });
    expect((await loadSettings(["historyTab"])).historyTab).toBe(EView.WALLET);
  });

  it("maps the legacy 'override' wallet type to wrapping and overriding the same wallet", async () => {
    setStorageData("sync", { walletType: "override", wrapWallet: "nami" });

    expect(await loadSettings(["walletType", "wrapWallet", "overrideWallet"])).toEqual({
      walletType: EWalletType.WRAP,
      wrapWallet: "nami",
      overrideWallet: "nami",
    });
  });

  it("reads every 'no wallet' spelling as null and round-trips null", async () => {
    setStorageData("sync", { wrapWallet: "none", overrideWallet: "" });
    expect(await loadSettings(["wrapWallet", "overrideWallet"])).toEqual({
      wrapWallet: null,
      overrideWallet: null,
    });

    setStorageData("sync", { wrapWallet: "not-a-wallet" });
    expect((await loadSettings(["wrapWallet"])).wrapWallet).toBeNull();

    await saveSettings({ wrapWallet: "eternl" });
    await saveSettings({ wrapWallet: null });
    expect((await loadSettings(["wrapWallet"])).wrapWallet).toBeNull();
  });

  it("coerces string output_index values stored by older UTxO builder versions", async () => {
    setStorageData("sync", {
      MOCK_UTXOS: [
        { address: "addr", tx_hash: "ab", output_index: "3", amount: [{ unit: "lovelace", quantity: "5" }] },
      ],
    });

    const { mockUtxos } = await loadSettings(["mockUtxos"]);

    expect(mockUtxos[0].output_index).toBe(3);
  });

  it("rejects a save that chrome.storage fails, instead of reporting success", async () => {
    failNextStorageOperation("sync");

    await expect(saveSettings({ impersonatedAddress: "addr_test1xyz" })).rejects.toThrow(
      "QUOTA_BYTES_PER_ITEM quota exceeded"
    );
    expect(getStorageData("sync")).toEqual({});
  });

  it("notifies only for the subscribed settings in the sync area", async () => {
    const listener = jest.fn();
    onSettingsChanged(["impersonatedAddress"], listener);

    await chrome.storage.sync.set({ historyTab: "tools" });
    await chrome.storage.local.set({ impersonatedAddress: "addr_local" });
    await flushChrome();
    expect(listener).not.toHaveBeenCalled();

    await chrome.storage.sync.set({ impersonatedAddress: "addr_test1abc" });
    await flushChrome();
    await flushChrome();
    expect(listener).toHaveBeenCalledWith({ impersonatedAddress: "addr_test1abc" });
  });
});
