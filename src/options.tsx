import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface IOptions {
  blockfrostApiKey?: string,
  blockfrostMainnetApiKey: string, blockfrostPreviewApiKey: string, 
  shouldScanForAddresses: true,
}
export const defaultOptions: IOptions = {
  blockfrostApiKey: undefined,
  blockfrostMainnetApiKey: "",
  blockfrostPreviewApiKey: "",
  shouldScanForAddresses: true
}

const Options = () => {
  const [blockfrostMainnetApiKey, setBlockfrostMainnetApiKey] = useState<string>("");
  const [blockfrostPreviewApiKey, setBlockfrostPreviewApiKey] = useState<string>("");
  const [shouldScanForAddresses, setShouldScanForAddresses] = useState(true);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    chrome.storage.sync.get(
      defaultOptions,
      (it) => {
        const items = it as IOptions
        if (items.blockfrostApiKey) {
          setBlockfrostMainnetApiKey(items.blockfrostApiKey);
        } else {
          setBlockfrostMainnetApiKey(items.blockfrostMainnetApiKey);
        }
        setBlockfrostPreviewApiKey(items.blockfrostPreviewApiKey);
        setShouldScanForAddresses(items.shouldScanForAddresses);
      }
    );
  }, []);

  const saveOptions = () => {
    // Saves options to chrome.storage.sync.
    chrome.storage.sync.set(
      {
        blockfrostApiKey: undefined,
        blockfrostMainnetApiKey,
        blockfrostPreviewApiKey,
        shouldScanForAddresses
      },
      () => {
        // Update status to let user know options were saved.
        setStatus("Options saved.");
        const id = setTimeout(() => {
          setStatus("");
        }, 1000);
        return () => clearTimeout(id);
      }
    );
  };

  return (
    <>
      <div>
        <label>
          Blockfrost Mainnet API Key: <input
            type="url"
            value={blockfrostMainnetApiKey}
            onChange={(event) => setBlockfrostMainnetApiKey(event.currentTarget.value)}
          />
        </label>
      </div>
      <div>
        <label>
          Blockfrost Preview API Key: <input
            type="url"
            value={blockfrostPreviewApiKey}
            onChange={(event) => setBlockfrostPreviewApiKey(event.currentTarget.value)}
          />
        </label>
      </div>
      <div>
        <label>
          Scan Page and Annotate Valid Addresses: <input
            type="checkbox"
            checked={shouldScanForAddresses}
            onChange={(event) => setShouldScanForAddresses(event.currentTarget.checked)}
          />
        </label>
      </div>
      <div>{status}</div>
      <button onClick={saveOptions}>Save</button>
    </>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
