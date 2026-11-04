import DevicesIcon from "@mui/icons-material/DevicesOther";
import LaunchIcon from "@mui/icons-material/LaunchRounded";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { Box, Button, Chip, Paper, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { loadP2PIsConnected, onP2PIsConnectedChanged } from "../../modules/p2pStorage";
import { PageMessageAction } from "../../protocol";
import { Log } from "../../utils/log_util";

const P2P_POPUP_WINDOW_NAME = "p2p_popup";
const POPUP_POLL_MS = 2000;

/** Button to launch P2P controls in a popup window  */
export const P2P_PopupButton = () => {
  const [hasPopup, setHasPopup] = useState(false);

  /** The manager window answers this ping while it is open, so closing it is noticed too. */
  useEffect(() => {
    let active = true;
    const ping = () =>
      chrome.runtime.sendMessage({ action: PageMessageAction.P2P_POPUP_EXISTS }, (response) => {
        // "Receiving end does not exist" simply means no manager window is open.
        void chrome.runtime.lastError;
        if (active) setHasPopup(response?.popupWindowExists === true);
      });
    ping();
    const timer = setInterval(ping, POPUP_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const [isConnected, setIsConnected] = useState(false);
  useEffect(() => {
    let active = true;
    loadP2PIsConnected()
      .then((connected) => active && setIsConnected(connected))
      .catch((e) => Log.E("p2p-popup-button: failed to read the connected flag", e));
    const unsubscribe = onP2PIsConnectedChanged(setIsConnected);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const openP2PWindow = () => {
    window.open(
      chrome.runtime.getURL("p2p_popup.html") + "#",
      P2P_POPUP_WINDOW_NAME,
      "width=420,height=580"
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Status Bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 1.5,
          borderRadius: 2,
          bgcolor: isConnected ? "success.50" : "grey.100",
          border: "1px solid",
          borderColor: isConnected ? "success.200" : "grey.200",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {isConnected ? (
            <LinkIcon sx={{ color: "success.main", fontSize: 20 }} />
          ) : (
            <LinkOffIcon sx={{ color: "grey.400", fontSize: 20 }} />
          )}
          <Box>
            <Typography variant="body2" fontWeight={600} color={isConnected ? "success.dark" : "text.secondary"}>
              {isConnected ? "P2P Connected" : "Not Connected"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isConnected ? "Remote dApp active" : "No active connections"}
            </Typography>
          </Box>
        </Box>
        <Chip
          size="small"
          icon={isConnected ? <CheckCircleIcon sx={{ fontSize: "14px !important" }} /> : undefined}
          label={isConnected ? "Live" : "Off"}
          sx={{
            bgcolor: isConnected ? "success.main" : "grey.300",
            color: "white",
            fontWeight: 600,
            "& .MuiChip-icon": { color: "white" },
          }}
        />
      </Box>

      {/* Action Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "grey.200",
          bgcolor: "white",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)",
              color: "white",
            }}
          >
            <DevicesIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              Connection Manager
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Connect to dApps on other devices
            </Typography>
          </Box>
        </Box>
        <Button
          fullWidth
          variant="contained"
          onClick={openP2PWindow}
          endIcon={<LaunchIcon sx={{ fontSize: 18 }} />}
        >
          {hasPopup ? "Open Manager" : "Launch Manager"}
        </Button>
      </Paper>

      {/* How it works - Compact */}
      {!isConnected && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: "grey.50",
            border: "1px solid",
            borderColor: "grey.100",
          }}
        >
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
            Quick Start
          </Typography>
          {[
            { num: "1", text: "Open the Connection Manager" },
            { num: "2", text: "Get a Peer ID from your dApp" },
            { num: "3", text: "Paste to connect" },
          ].map((step) => (
            <Box key={step.num} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.75 }}>
              <Typography
                variant="caption"
                sx={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  bgcolor: "grey.200",
                  color: "grey.600",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                {step.num}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {step.text}
              </Typography>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
};
