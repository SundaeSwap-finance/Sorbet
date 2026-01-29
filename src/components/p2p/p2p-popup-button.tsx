import DevicesIcon from "@mui/icons-material/DevicesOther";
import LaunchIcon from "@mui/icons-material/LaunchRounded";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { Avatar, Box, Button, Paper, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { P2PStorageKeys, makeStorageChangeListener } from "../../utils/storage";

/** Button to launch P2P controls in a popup window  */
export const P2P_PopupButton = () => {
  const P2P_POPUP_WINDOW_NAME = "p2p_popup";
  const [p2pPopup, setP2pPopup] = useState<Window>();
  const hasPopup = p2pPopup !== undefined && !p2pPopup.closed;

  useEffect(() => {
    chrome.runtime.sendMessage({ action: "p2p_popup_exists" }, (response) => {
      if (response?.popupWindowExists) {
        const popupWindow = window.open("", P2P_POPUP_WINDOW_NAME);
        if (popupWindow) setP2pPopup(popupWindow);
      }
    });
  }, []);

  const [isConnected, setIsConnected] = useState(false);
  useEffect(() => {
    const listener = makeStorageChangeListener(
      P2PStorageKeys.P2P_IS_CONNECTED,
      (isConnected: boolean) => setIsConnected(isConnected),
      true,
      ""
    );
    return () => listener();
  }, []);

  const openP2PWindow = () => {
    const popupWindow = window.open(
      chrome.runtime.getURL("p2p_popup.html") + "#",
      P2P_POPUP_WINDOW_NAME,
      "width=420,height=580"
    );
    if (popupWindow && !popupWindow.closed) {
      setP2pPopup(popupWindow);
    } else {
      setP2pPopup(undefined);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Hero Card */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          background: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)",
          color: "white",
          textAlign: "center",
        }}
      >
        <Avatar
          sx={{
            width: 56,
            height: 56,
            bgcolor: "rgba(255,255,255,0.2)",
            mx: "auto",
            mb: 2,
          }}
        >
          <DevicesIcon sx={{ fontSize: 28 }} />
        </Avatar>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
          Remote Connection
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9, mb: 2.5 }}>
          Connect to dApps on other devices using CIP-45 peer-to-peer protocol
        </Typography>
        <Button
          variant="contained"
          fullWidth
          onClick={openP2PWindow}
          endIcon={<LaunchIcon />}
          sx={{
            bgcolor: "background.paper",
            color: "text.primary",
            fontWeight: 600,
            "&:hover": { bgcolor: "background.paper" },
          }}
        >
          {hasPopup ? "Open Manager" : "Launch Connection Manager"}
        </Button>
      </Paper>

      {/* Status */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          gap: 2,
          borderColor: isConnected ? "success.200" : "grey.200",
          bgcolor: isConnected ? "success.50" : "transparent",
        }}
      >
        {isConnected ? (
          <CheckCircleIcon sx={{ color: "success.main", fontSize: 24 }} />
        ) : (
          <RadioButtonUncheckedIcon sx={{ color: "grey.400", fontSize: 24 }} />
        )}
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" fontWeight={600}>
            {isConnected ? "Connected" : "Not Connected"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isConnected ? "dApp connection active" : "No active P2P connections"}
          </Typography>
        </Box>
      </Paper>

      {/* Instructions */}
      {!isConnected && (
        <Box sx={{ px: 1 }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
            How it works
          </Typography>
          {[
            "Open the Connection Manager above",
            "Get a Peer ID from your dApp",
            "Paste it to establish connection",
          ].map((step, i) => (
            <Box key={i} sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
              <Avatar
                sx={{
                  width: 22,
                  height: 22,
                  bgcolor: "primary.100",
                  color: "primary.main",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </Avatar>
              <Typography variant="body2" color="text.secondary" sx={{ pt: 0.25 }}>
                {step}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
