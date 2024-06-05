import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { P2PConnectComponent } from "./components/p2p/p2p-connect";
import { P2PProvider } from "./hooks/useP2P";
import { initSorbetDOMObjectWithProperties } from "./injected/init_sorbet_dom";
import { P2PStorageKeys, getFromStorage } from "./utils/storage";
import { Log } from "./utils/log_util";

export const BackgroundMessageActions = {
    connectP2P: "connectP2PClient",
    disconnectP2P: "disconnectP2PClient",
}

const P2P_Popup = () => {
    async function loadP2PWalletDom() {
        if (typeof window.cardano === "undefined") {
          window.cardano = {};
        }
        const extensionBaseURL = chrome.runtime.getURL("");
        const storage = await getFromStorage([
            "wrapWallet",
            "impersonatedAddress",
            "walletType",
        ]);
        const { walletType, impersonatedAddress, wrapWallet } = storage
        initSorbetDOMObjectWithProperties(extensionBaseURL, wrapWallet, impersonatedAddress, walletType, true)
    }
    useEffect(() => {
        loadP2PWalletDom()
        /** respond to queries for existing popup  */
        chrome.runtime.onMessage.addListener(handleMessage);
        function handleMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
            if (request.action === 'p2p_popup_exists') {
                Log.App.Message("p2p_popup: handleMessage p2p_popup_exists", request)
                sendResponse({popupWindowExists: true})
            }
        }
    }, [])
    return (
        <P2PProvider>
            <P2PConnectComponent />
        </P2PProvider>
    )
}

const root = createRoot(document.getElementById("p2p_root")!);

root.render(
    <React.StrictMode>
        <P2P_Popup />
    </React.StrictMode>
);
