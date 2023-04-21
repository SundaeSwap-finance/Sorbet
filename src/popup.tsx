import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select/Select";
import CssBaseline from "@mui/material/CssBaseline";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import OverrideIcon from "@mui/icons-material/Settings";
import DebugIcon from "@mui/icons-material/Analytics";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { InputLabel, Stack, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { EView, EWalletType } from "./types";

const theme = createTheme();

const Popup = () => {
  const [view, setView] = useState<EView>(EView.OVERRIDE);
  const [impersonate, setImpersonate] = useState<string>("");
  const [wallet, setWallet] = useState<string>("none");
  const [walletType, setWalletType] = useState<EWalletType>(EWalletType.IMPERSONATE);

  useEffect(() => {
    chrome.storage.sync.get(["impersonatedWallet", "walletType", "wallet"], function (result) {
      setWallet(result.wallet ?? wallet);
      setWalletType(result.walletType ?? walletType);
      setImpersonate(result.impersonatedWallet ?? impersonate);
    });
  }, []);

  const updateWalletType = (newValue: EWalletType) => {
    chrome.storage.sync.set({ walletType: newValue }, function () {
      setWalletType(newValue ?? "");
    });
  };

  const updateWallet = (newValue: string) => {
    chrome.storage.sync.set({ wallet: newValue }, function () {
      setWallet(newValue ?? "");
    });
  };

  const clearImpersonateWallet = () => {
    chrome.storage.sync.set({ impersonatedWallet: "" }, function () {
      setImpersonate("");
    });
  };

  const updateImpersonatedWallet = (newValue: string) => {
    chrome.storage.sync.set({ impersonatedWallet: newValue }, function () {
      setImpersonate(newValue ?? "");
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <Container component="main" style={{ width: 300 }}>
        <CssBaseline />
        <Box
          sx={{
            marginTop: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Typography component="h1" variant="h5" fontWeight="bold">
            Sorbet Settings
          </Typography>
        </Box>
        <Stack direction="row" spacing={4} sx={{ marginTop: 2 }}>
          <ToggleButtonGroup
            value={view}
            exclusive
            fullWidth
            onChange={(e, value) => setView(value)}
            aria-label="text alignment"
          >
            <ToggleButton value={EView.OVERRIDE} aria-label="right aligned">
              <OverrideIcon />
            </ToggleButton>
            <ToggleButton value={EView.DEBUG} aria-label="left aligned">
              <DebugIcon />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Box
          sx={{
            marginTop: 2,
            marginBottom: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {EView.OVERRIDE === view && (
            <>
              <InputLabel id="wallet-type">Wallet Type</InputLabel>
              <Select
                fullWidth
                labelId="wallet-type"
                label={walletType}
                value={walletType}
                style={{ marginBottom: 12 }}
                onChange={(e) => updateWalletType(e.target.value as EWalletType)}
              >
                <MenuItem value="impersonate">Impersonate</MenuItem>
                <MenuItem value="wrap">Wrap</MenuItem>
                <MenuItem value="override">Override</MenuItem>
              </Select>
              {EWalletType.IMPERSONATE === walletType ? (
                <>
                  <TextField
                    label="Impersonated Address"
                    fullWidth
                    value={impersonate}
                    type="text"
                    onChange={(e) => updateImpersonatedWallet(e.target.value)}
                  />
                  {impersonate && (
                    <Button style={{ marginTop: 2 }} onClick={clearImpersonateWallet}>
                      Clear
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <InputLabel id="wallet">Wallet</InputLabel>
                  <Select
                    fullWidth
                    labelId="wallet"
                    label={wallet}
                    value={wallet}
                    onChange={(e) => updateWallet(e.target.value)}
                  >
                    <MenuItem value="none">None</MenuItem>
                    <MenuItem value="begin">Begin</MenuItem>
                    <MenuItem value="eternl">Eternl</MenuItem>
                    <MenuItem value="nami">Nami</MenuItem>
                    <MenuItem value="typhoncip30">Typhon</MenuItem>
                    <MenuItem value="yoroi">Yoroi</MenuItem>
                  </Select>
                </>
              )}
            </>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
