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
import { getFromStorage } from "./utils/storage";

const theme = createTheme();

const Popup = () => {
  const [view, setView] = useState<EView>(EView.OVERRIDE);
  const [walletType, setWalletType] = useState<EWalletType>(EWalletType.IMPERSONATE);
  const [impersonatedAddress, setImpersonatedAddress] = useState<string>("");
  const [wrapWallet, setWrapWallet] = useState<string>("none");
  const [overrideWallet, setOverrideWallet] = useState<string>("none");
  const [isOverridden, setIsOverridden] = useState<Boolean>(false);

  useEffect(() => {
    chrome.storage.sync.get(
      ["impersonatedAddress", "walletType", "wrapWallet", "overrideWallet"],
      function (result) {
        setWalletType(result.walletType ?? walletType);
        setImpersonatedAddress(result.impersonatedAddress ?? impersonatedAddress);
        setWrapWallet(result.wrapWallet ?? wrapWallet);
        setOverrideWallet(result.overrideWallet ?? overrideWallet);
        if (result.overrideWallet !== 'none') {
          console.log('setOverridden')
          setIsOverridden(true);
        }
      }
    );
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
    console.log('overriding wallet to', newValue)
    chrome.storage.sync.set({ overrideWallet: newValue }, function () {
      console.log('persisted to sync', newValue)
      setOverrideWallet(newValue ?? "");
    });
  };

  const updateIsOverridden = (newValue: boolean) => {
    if (!newValue) {
      updateOverrideWallet('none');
    }
    setIsOverridden(newValue);
  };

  const clearImpersonateWallet = () => {
    chrome.storage.sync.set({ impersonatedAddress: "" }, function () {
      setImpersonatedAddress("");
    });
  };

  const lookupHandle = async (handle: string) => {
    const { blockfrostApiKey } = await getFromStorage("blockfrostApiKey");
    let headers: Record<string, string> = {};
    if (Boolean(blockfrostApiKey)) {
      headers.project_id = blockfrostApiKey;
    }

    let fetchParams = {
      method: "GET",
      headers,
    };

    // TODO: preview support
    const blockfrostUrl = "https://cardano-mainnet.blockfrost.io";

    const policyId = "f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a"
    const handleHex = Buffer.from(handle).toString("hex");

    const res = await fetch(
      new URL(`/api/v0/assets/${policyId}${handleHex}/addresses`, blockfrostUrl),
      fetchParams
    );
    const addresses = await res.json();
    if (addresses.length > 1) {
      console.log("Found multiple addresses for handle", handle);
      return undefined;
    } else {
      console.log("Found address for handle", handle, addresses[0]);
      return addresses[0].address;
    }
  }
  const updateImpersonatedWallet = (newValue: string) => {
    chrome.storage.sync.set({ impersonatedAddress: newValue }, function () {
      setImpersonatedAddress(newValue ?? "");
    });
  };
  const finalizeImpersonatedWallet = async (newValue: string) => {
    if (newValue.startsWith("$")) {
      console.log("looking up handle", newValue)
      newValue = await lookupHandle(newValue.slice(1));
    }
    updateImpersonatedWallet(newValue);
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
              </Select>
              {EWalletType.IMPERSONATE === walletType ? (
                <>
                  <TextField
                    label="Impersonated Address"
                    fullWidth
                    value={impersonatedAddress}
                    type="text"
                    onChange={(e) => updateImpersonatedWallet(e.target.value)}
                    onBlur={(e) => finalizeImpersonatedWallet(e.target.value)}
                  />
                  {impersonatedAddress && (
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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <InputLabel id="is-override">Override Wallet?</InputLabel>
          <Switch checked={Boolean(isOverridden)} onChange={(e) => updateIsOverridden(e.target.checked)} />
        </Box>
        {isOverridden && (
          <WalletSelect label="" wallet={overrideWallet} onChange={updateOverrideWallet} />
        )}
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
