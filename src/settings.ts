import { EView, EWalletType, UTxO, WalletId, isWalletId } from "./types";
import { Log } from "./utils/log_util";
import { onStorageChanged, storageGet, storageRemove, storageSet } from "./utils/storage";

/**
 * Every user setting persisted in chrome.storage.sync, in one canonical shape.
 * Extension contexts (background, popup, options, p2p popup) read and write settings
 * through this module; raw chrome.storage access to these keys is a bug. Content scripts
 * cannot read storage (the background restricts it to trusted contexts) and ask the
 * background for what they need instead.
 */
export interface Settings {
  /** Bech32 address Sorbet impersonates; "" when unset. */
  impersonatedAddress: string;
  walletType: EWalletType;
  /** Wallet that window.cardano.sorbet wraps in WRAP mode; null when none chosen. */
  wrapWallet: WalletId | null;
  /** Wallet whose window.cardano entry Sorbet replaces; null when override is off. */
  overrideWallet: WalletId | null;
  historyTab: EView;
  blockfrostMainnetApiKey: string;
  blockfrostPreviewApiKey: string;
  shouldScanForAddresses: boolean;
  customResponseEnabled: boolean;
  mockUtxos: UTxO[];
}
export type SettingKey = keyof Settings;

const DEFAULT_SETTINGS: Settings = {
  impersonatedAddress: "",
  walletType: EWalletType.IMPERSONATE,
  wrapWallet: null,
  overrideWallet: null,
  historyTab: EView.WALLET,
  blockfrostMainnetApiKey: "",
  blockfrostPreviewApiKey: "",
  shouldScanForAddresses: true,
  customResponseEnabled: false,
  mockUtxos: [],
};

/** chrome.storage.sync key that stores each setting. */
const STORAGE_KEY = {
  impersonatedAddress: "impersonatedAddress",
  walletType: "walletType",
  wrapWallet: "wrapWallet",
  overrideWallet: "overrideWallet",
  historyTab: "historyTab",
  blockfrostMainnetApiKey: "blockfrostMainnetApiKey",
  blockfrostPreviewApiKey: "blockfrostPreviewApiKey",
  shouldScanForAddresses: "shouldScanForAddresses",
  customResponseEnabled: "CUSTOM_RESPONSE_ENABLED",
  mockUtxos: "MOCK_UTXOS",
} as const satisfies Record<SettingKey, string>;

/** Pre-split mainnet key. Read as a fallback, deleted whenever the mainnet key is saved. */
const LEGACY_BLOCKFROST_API_KEY = "blockfrostApiKey";
/** Legacy walletType value; now WRAP plus overrideWallet = wrapWallet. */
const LEGACY_OVERRIDE_WALLET_TYPE = "override";
/** Stored form of "no wallet" for wrapWallet/overrideWallet. */
const NO_WALLET = "none";

/** Raw storage keys each setting is parsed from (its own key plus legacy inputs). */
const STORAGE_INPUTS: Record<SettingKey, readonly string[]> = {
  impersonatedAddress: [STORAGE_KEY.impersonatedAddress],
  walletType: [STORAGE_KEY.walletType],
  wrapWallet: [STORAGE_KEY.wrapWallet],
  overrideWallet: [STORAGE_KEY.overrideWallet, STORAGE_KEY.walletType, STORAGE_KEY.wrapWallet],
  historyTab: [STORAGE_KEY.historyTab],
  blockfrostMainnetApiKey: [STORAGE_KEY.blockfrostMainnetApiKey, LEGACY_BLOCKFROST_API_KEY],
  blockfrostPreviewApiKey: [STORAGE_KEY.blockfrostPreviewApiKey],
  shouldScanForAddresses: [STORAGE_KEY.shouldScanForAddresses],
  customResponseEnabled: [STORAGE_KEY.customResponseEnabled],
  mockUtxos: [STORAGE_KEY.mockUtxos],
};

const ALL_SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

const LEGACY_VIEWS: Record<string, EView> = {
  override: EView.WALLET,
  debug: EView.WALLET,
  addressbook: EView.CONTACTS,
  p2p_connect: EView.CONNECT,
  utxo_builder: EView.TOOLS,
  logviewer: EView.TOOLS,
};

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

function parseView(value: unknown): EView {
  if ((Object.values(EView) as unknown[]).includes(value)) return value as EView;
  return (typeof value === "string" && LEGACY_VIEWS[value]) || DEFAULT_SETTINGS.historyTab;
}

function parseOutputIndex(value: unknown): number {
  const index = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof index === "number" && Number.isInteger(index) && index >= 0 ? index : 0;
}

/** Parse stored mock UTxOs. Older builder versions stored output_index as a string. */
function parseMockUtxos(value: unknown): UTxO[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      address: typeof entry.address === "string" ? entry.address : "",
      tx_hash: typeof entry.tx_hash === "string" ? entry.tx_hash : "",
      output_index: parseOutputIndex(entry.output_index),
      amount: Array.isArray(entry.amount)
        ? entry.amount
            .filter((q): q is Record<string, unknown> => typeof q === "object" && q !== null)
            .map((q) => ({
              unit: typeof q.unit === "string" ? q.unit : "lovelace",
              quantity: typeof q.quantity === "string" ? q.quantity : String(q.quantity ?? "0"),
            }))
        : [],
    }));
}

/**
 * Parse raw chrome.storage.sync items into Settings. Pure; handles every legacy shape:
 * the single `blockfrostApiKey`, walletType "override", "none"/"" wallet sentinels,
 * pre-redesign historyTab values, and string output_index in mock UTxOs.
 */
function parseSettings(raw: Record<string, unknown>): Settings {
  const walletType = raw[STORAGE_KEY.walletType];
  const storedWrap = raw[STORAGE_KEY.wrapWallet];
  const wrapWallet = isWalletId(storedWrap) ? storedWrap : null;
  const storedOverride = raw[STORAGE_KEY.overrideWallet];
  const shouldScan = raw[STORAGE_KEY.shouldScanForAddresses];
  return {
    impersonatedAddress: nonEmptyString(raw[STORAGE_KEY.impersonatedAddress]) ?? "",
    walletType:
      walletType === EWalletType.WRAP || walletType === LEGACY_OVERRIDE_WALLET_TYPE
        ? EWalletType.WRAP
        : EWalletType.IMPERSONATE,
    wrapWallet,
    overrideWallet: isWalletId(storedOverride)
      ? storedOverride
      : walletType === LEGACY_OVERRIDE_WALLET_TYPE
      ? wrapWallet
      : null,
    historyTab: parseView(raw[STORAGE_KEY.historyTab]),
    blockfrostMainnetApiKey:
      nonEmptyString(raw[STORAGE_KEY.blockfrostMainnetApiKey]) ??
      nonEmptyString(raw[LEGACY_BLOCKFROST_API_KEY]) ??
      "",
    blockfrostPreviewApiKey: nonEmptyString(raw[STORAGE_KEY.blockfrostPreviewApiKey]) ?? "",
    shouldScanForAddresses:
      typeof shouldScan === "boolean" ? shouldScan : DEFAULT_SETTINGS.shouldScanForAddresses,
    customResponseEnabled: raw[STORAGE_KEY.customResponseEnabled] === true,
    mockUtxos: parseMockUtxos(raw[STORAGE_KEY.mockUtxos]),
  };
}

const storageInputsFor = (keys: readonly SettingKey[]): string[] => [
  ...new Set(keys.flatMap((key) => STORAGE_INPUTS[key])),
];

function pick<K extends SettingKey>(settings: Settings, keys: readonly K[]): Pick<Settings, K> {
  const picked = {} as Pick<Settings, K>;
  for (const key of keys) picked[key] = settings[key];
  return picked;
}

/** Load and parse the given settings (all settings when `keys` is omitted). */
export async function loadSettings(): Promise<Settings>;
export async function loadSettings<K extends SettingKey>(keys: readonly K[]): Promise<Pick<Settings, K>>;
export async function loadSettings(keys: readonly SettingKey[] = ALL_SETTING_KEYS) {
  const raw = await storageGet("sync", storageInputsFor(keys));
  return pick(parseSettings(raw), keys);
}

/** Serialize one setting to its stored form. */
function serialize<K extends SettingKey>(key: K, value: Settings[K]): unknown {
  if (key === "wrapWallet" || key === "overrideWallet") return value ?? NO_WALLET;
  return value;
}

/**
 * Persist a partial settings update. Rejects when chrome.storage fails (e.g. quota), so
 * callers can surface the failure instead of showing success. Saving the mainnet key
 * deletes the legacy `blockfrostApiKey`, which would otherwise shadow later edits.
 */
export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const items: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as SettingKey[]) {
    if (patch[key] === undefined) continue;
    items[STORAGE_KEY[key]] = serialize(key, patch[key] as Settings[typeof key]);
  }
  if (Object.keys(items).length === 0) return;
  await storageSet("sync", items);
  if (patch.blockfrostMainnetApiKey !== undefined) {
    await storageRemove("sync", [LEGACY_BLOCKFROST_API_KEY]);
  }
}

/**
 * Subscribe to changes of the given settings in chrome.storage.sync. The listener receives
 * freshly parsed values for `keys` and only fires when one of their storage inputs changed.
 * Returns the unsubscribe function.
 */
export function onSettingsChanged<K extends SettingKey>(
  keys: readonly K[],
  listener: (settings: Pick<Settings, K>) => void
): () => void {
  let active = true;
  const unsubscribe = onStorageChanged("sync", storageInputsFor(keys), () => {
    loadSettings(keys).then(
      (settings) => {
        if (active) listener(settings);
      },
      (error) => Log.E(error, "settings reload failed")
    );
  });
  return () => {
    active = false;
    unsubscribe();
  };
}

/** Settings needed to install Sorbet in a web page; the background serves them to the content script. */
export type WalletInjectionSettings = Pick<
  Settings,
  "walletType" | "wrapWallet" | "overrideWallet" | "shouldScanForAddresses"
>;
export const WALLET_INJECTION_KEYS = [
  "walletType",
  "wrapWallet",
  "overrideWallet",
  "shouldScanForAddresses",
] as const satisfies readonly (keyof WalletInjectionSettings)[];
