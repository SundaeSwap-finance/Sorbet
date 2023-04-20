import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Options = () => {
  const [blockfrostUrl, setBlockfrostUrl] = useState<string>("");
  const [blockfrostApiKey, setBlockfrostApiKey] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    chrome.storage.sync.get(
      {
        blockfrostUrl: "",
        blockfrostApiKey: ""
      },
      (items) => {
        setBlockfrostUrl(items.blockfrostUrl);
        setBlockfrostApiKey(items.blockfrostApiKey);
      }
    );
  }, []);

  const saveOptions = () => {
    // Saves options to chrome.storage.sync.
    chrome.storage.sync.set(
      {
        blockfrostUrl,
        blockfrostApiKey
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
          Blockfrost URL: <input
            type="url"
            value={blockfrostUrl}
            onChange={(event) => setBlockfrostUrl(event.currentTarget.value)}
          />
        </label>
      </div>
      <div>
        <label>
          Blockfrost API Key: <input
            type="url"
            value={blockfrostApiKey}
            onChange={(event) => setBlockfrostApiKey(event.currentTarget.value)}
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
