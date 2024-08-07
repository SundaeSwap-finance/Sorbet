type StorageKey = P2PStorageKeys | CustomResponseStorageKeys

/** Custom UTxO Builder */
export type CustomResponseStorageKeys = typeof CustomResponseStorageKeys[keyof typeof CustomResponseStorageKeys]
export const CustomResponseStorageKeys = {
  MOCK_UTXOS: 'MOCK_UTXOS',
  CUSTOM_RESPONSE_ENABLED: 'CUSTOM_RESPONSE_ENABLED'
} as const;

/** CIP-45 aka P2P Connect, or Peer Connect */
export type P2PStorageKeys = typeof P2PStorageKeys[keyof typeof P2PStorageKeys]
export const P2PStorageKeys = {
  P2P_SEEDS: 'p2p_seeds',
  P2P_IS_CONNECTED: 'p2p_isConnected',
} as const;

/**
 * Retrieve objects from storage
 * @param keys storage key names to retrieve
 * @returns 
 */
export function getFromStorage(keys: string | string[] | {
  [key: string]: any;
} | null): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve(items);
      }
    });
  });
}

/**
 * Make a new function to listen for storage changes : for use inside of a local useEffect hook
 * @TODO allow for multiple properties in one listener
 * @param storageKey 
 * @param currentVal 
 * @param sendUpdate 
 * @param executeOnAdd specifies to execute a storage retrieval once when adding
 * @param defaultVal the default value to use if executeOnAdd == true
 * @returns the remove hook for returning from useEffect
 * 
 * @TODO allow for passing a list of objectify storage properties, e.g. {storageKey, setter}[]
 */
export const makeStorageChangeListener = (storageKey: StorageKey, sendUpdate: (newVal: any) => void, executeOnAdd?: true, defaultVal?: any) => {
  if (executeOnAdd) {
    chrome.storage.sync.get(
      [storageKey],
      function (result) {
        sendUpdate(result[storageKey] ?? defaultVal);
      }
    )
  }
  const storageChangedListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    const shouldUpdateState = changes[storageKey] !== undefined && changes[storageKey].newValue !== changes[storageKey].oldValue
    if (shouldUpdateState) {
      sendUpdate(changes[storageKey].newValue)
    }
  }
  chrome.storage.onChanged.addListener(storageChangedListener)
  return () => {
    chrome.storage.onChanged.removeListener(storageChangedListener);
  };
}