import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Popup = () => {
  const [wrappedWallet, setWrappedWallet] = useState<string | undefined>(undefined);

  useEffect(() => {
    chrome.storage.local.get(['wrappedWallet'], function(result) {
      setWrappedWallet(result.wrappedWallet);
    });
  }, []);

  const updateWrappedWallet = (evt: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = evt.target.value === '' ? undefined : evt.target.value;
    chrome.storage.local.set({ 'wrappedWallet': newValue }, function() {
      setWrappedWallet(newValue);
    });
  }

  return (
    <>
      <h1>Sorbet</h1>
      <p>Wrap wallet</p>
      <select value={wrappedWallet} onChange={updateWrappedWallet}>
        <option value="">None</option>
        <option value="begin">Begin</option>
        <option value="eternl">Eternl</option>
        <option value="nami">Nami</option>
        <option value="typhoncip30">Typhon</option>
        <option value="yoroi">Yoroi</option>
      </select>
    </>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
