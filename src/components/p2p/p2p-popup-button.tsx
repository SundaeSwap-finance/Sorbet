import PopoutIcon from "@mui/icons-material/OpenInNewOutlined";
import React, { useEffect, useState } from "react";
import { P2PStorageKeys, makeStorageChangeListener } from "../../utils/storage";
import { SorbetIconButton } from "../sorbet-icon-button";
import { ConnectStateComponent } from "./p2p-connect-state";

/** Button to launch P2P controls in a popup window  */
export const P2P_PopupButton = () => {
    const P2P_POPUP_WINDOW_NAME = "p2p_popup"
    const [p2pPopup, setP2pPopup] = useState<Window>()
    const hasPopup = p2pPopup !== undefined && !p2pPopup.closed
    useEffect(() => {
      /** detect existing popup window  */
      chrome.runtime.sendMessage({ action: 'p2p_popup_exists' },
        (response) => {
          if (response.popupWindowExists) {
            let popupWindow = window.open("", P2P_POPUP_WINDOW_NAME)
            if (popupWindow)
              setP2pPopup(popupWindow)
          }
        })
    }, [])
    /** detect if p2p is connected  */
    const [isConnected, setIsConnected] = useState(false)
    useEffect(() => {
      const listener = makeStorageChangeListener(P2PStorageKeys.P2P_IS_CONNECTED, (isConnected: boolean) => setIsConnected(isConnected), true, "")
      return () => { listener() }
    }, [])
    return (
      <div>
        {hasPopup ? <span>Focus P2P window:</span>
          : <span>Launch new P2P window:</span>}
        <SorbetIconButton
          color={isConnected ? 'success' : hasPopup ?  'warning' : 'primary'}
          tooltipTitle="Open in new window for persistent connection."
          onClick={() => {
            let popupWindow = window.open(
              chrome.runtime.getURL("p2p_popup.html") + "#",
              P2P_POPUP_WINDOW_NAME,
              "width=480,height=640"
            )
            if (popupWindow && !popupWindow.closed) {
              setP2pPopup(popupWindow)
            } else {
              setP2pPopup(undefined)
            }
          }}>
          <PopoutIcon />
        </SorbetIconButton>
        <ConnectStateComponent connected={isConnected} />
      </div>
    )
  }