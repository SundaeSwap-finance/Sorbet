import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Popup = () => {
  const [impersonate, setImpersonate] = useState<string>("");
  const [wrappedWallet, setWrappedWallet] = useState<string>("");

  useEffect(() => {
    chrome.storage.local.get(['wrappedWallet', 'impersonatedWallet'], function(result) {
      setWrappedWallet(result.wrappedWallet);
      setImpersonate(result.impersonatedWallet);
    });
  }, []);

  const updateWrappedWallet = (evt: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = evt.currentTarget.value;
    chrome.storage.local.set({ 'wrappedWallet': newValue }, function() {
      setWrappedWallet(newValue ?? "");
    });
  }

  const updateImpersonatedWallet = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = evt.currentTarget.value === '' ? undefined : evt.currentTarget.value;
    chrome.storage.local.set({ 'impersonatedWallet': newValue }, function() {
      setImpersonate(newValue ?? "");
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
      <h4>Impersonate Wallet</h4>
      <input type="text" value={impersonate} onChange={updateImpersonatedWallet} />
      <button onClick={() => setImpersonate("")}>Clear</button>
    </>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
