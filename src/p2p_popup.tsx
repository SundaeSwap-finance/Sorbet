import { Alert, CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { P2PConnectComponent } from "./components/p2p/p2p-connect";
import { P2PProvider } from "./hooks/useP2P";
import { initSorbetWallet } from "./injected/init_sorbet_dom";
import { PageMessageAction, runtimeTransport } from "./protocol";
import { WALLET_INJECTION_KEYS, loadSettings } from "./settings";
import { sorbetTheme } from "./theme";
import { Log } from "./utils/log_util";

const P2P_Popup = () => {
  const [initError, setInitError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    loadSettings(WALLET_INJECTION_KEYS)
      .then(({ walletType, wrapWallet, overrideWallet }) => {
        if (cancelled) return;
        const installed = initSorbetWallet(
          { walletType, wrapWallet, overrideWallet, extensionBaseURL: chrome.runtime.getURL("") },
          { p2p: true, transport: runtimeTransport }
        );
        if (!installed) {
          setInitError("The Sorbet wallet could not be installed in this window.");
        }
      })
      .catch((e) => {
        Log.E("p2p_popup: failed to initialize the wallet", e);
        if (!cancelled) setInitError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleMessage = (
      request: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      if (
        typeof request === "object" &&
        request !== null &&
        "action" in request &&
        request.action === PageMessageAction.P2P_POPUP_EXISTS
      ) {
        sendResponse({ popupWindowExists: true });
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  return (
    <ThemeProvider theme={sorbetTheme}>
      <CssBaseline />
      {initError !== undefined && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {initError}
        </Alert>
      )}
      <P2PProvider>
        <P2PConnectComponent />
      </P2PProvider>
    </ThemeProvider>
  );
};

const root = createRoot(document.getElementById("p2p_root")!);

root.render(
  <React.StrictMode>
    <P2P_Popup />
  </React.StrictMode>
);
