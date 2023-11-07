import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Options = () => {
  const [blockfrostMainnetApiKey, setBlockfrostMainnetApiKey] = useState<string>("");
  const [blockfrostPreviewApiKey, setBlockfrostPreviewApiKey] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    chrome.storage.sync.get(
      {
        blockfrostApiKey: undefined,
        blockfrostMainnetApiKey: "",
        blockfrostPreviewApiKey: ""
      },
      (items) => {
        if (items.blockfrostApiKey) {
          setBlockfrostMainnetApiKey(items.blockfrostApiKey);
        } else {
          setBlockfrostMainnetApiKey(items.blockfrostMainnetApiKey);
        }
        setBlockfrostPreviewApiKey(items.blockfrostPreviewApiKey);
      }
    );
  }, []);

  const saveOptions = () => {
    // Saves options to chrome.storage.sync.
    chrome.storage.sync.set(
      {
        blockfrostApiKey: undefined,
        blockfrostMainnetApiKey,
        blockfrostPreviewApiKey
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
