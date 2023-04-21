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
