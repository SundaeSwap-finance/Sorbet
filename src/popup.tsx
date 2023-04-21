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
import { InputLabel, Stack, ToggleButton, ToggleButtonGroup, Switch } from "@mui/material";
import { EView, EWalletType } from "./types";
import { WalletSelect } from "./components/wallet-select";

const theme = createTheme();

const Popup = () => {
  const [view, setView] = useState<EView>(EView.OVERRIDE);
  const [walletType, setWalletType] = useState<EWalletType>(EWalletType.IMPERSONATE);
  const [impersonateAddress, setImpersonateAddress] = useState<string>("");
  const [wrapWallet, setWrapWallet] = useState<string>("none");
  const [overrideWallet, setOverrideWallet] = useState<string>("none");
  const [isOverridden, setIsOverridden] = useState<Boolean>(false);

  useEffect(() => {
    chrome.storage.sync.get(["impersonatedAddress", "walletType", "wrapWallet", "overrideWallet"], function (result) {
      setWalletType(result.walletType ?? walletType);
      setImpersonateAddress(result.impersonatedAddress ?? impersonateAddress);
      setWrapWallet(result.wrapWallet ?? wrapWallet);
      setOverrideWallet(result.overrideWallet ?? overrideWallet);
    });
  }, []);

  const updateWalletType = (newValue: EWalletType) => {
    chrome.storage.sync.set({ walletType: newValue }, function () {
      setWalletType(newValue ?? "");
    });
  };

  const updateWrapWallet = (newValue: string) => {
    chrome.storage.sync.set({ wrapWallet: newValue }, function () {
      setWrapWallet(newValue ?? "");
    });
  };

  const updateOverrideWallet = (newValue: string) => {
    chrome.storage.sync.set({ overrideWallet: newValue }, function () {
      setOverrideWallet(newValue ?? "");
    });
  };

  const clearImpersonateWallet = () => {
    chrome.storage.sync.set({ impersonatedWallet: "" }, function () {
      setImpersonateAddress("");
    });
  };

  const updateImpersonatedWallet = (newValue: string) => {
    chrome.storage.sync.set({ impersonatedWallet: newValue }, function () {
      setImpersonateAddress(newValue ?? "");
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
          <InputLabel id="is-override">Override Wallet?</InputLabel>
          <Switch value={isOverridden} onChange={(e) => setIsOverridden(e.target.checked)} />
          {isOverridden && (
            <WalletSelect label="Override" wallet={overrideWallet} onChange={updateOverrideWallet} />
          )}
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
              </Select>
              {EWalletType.IMPERSONATE === walletType ? (
                <>
                  <TextField
                    label="Impersonated Address"
                    fullWidth
                    value={impersonateAddress}
                    type="text"
                    onChange={(e) => updateImpersonatedWallet(e.target.value)}
                  />
                  {impersonateAddress && (
                    <Button style={{ marginTop: 2 }} onClick={clearImpersonateWallet}>
                      Clear
                    </Button>
                  )}
                </>
              ) : (
                <WalletSelect wallet={wrapWallet} onChange={updateWrapWallet} />
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
