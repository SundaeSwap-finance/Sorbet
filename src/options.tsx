import CheckIcon from "@mui/icons-material/Check";
import KeyIcon from "@mui/icons-material/VpnKey";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Alert,
  Box,
  Button,
  Container,
  CssBaseline,
  Divider,
  FormControlLabel,
  Paper,
  Snackbar,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { sorbetTheme } from "./theme";

interface IOptions {
  blockfrostApiKey?: string;
  blockfrostMainnetApiKey: string;
  blockfrostPreviewApiKey: string;
  shouldScanForAddresses: boolean;
}

export const defaultOptions: IOptions = {
  blockfrostApiKey: undefined,
  blockfrostMainnetApiKey: "",
  blockfrostPreviewApiKey: "",
  shouldScanForAddresses: true,
};

const Options = () => {
  const [blockfrostMainnetApiKey, setBlockfrostMainnetApiKey] = useState<string>("");
  const [blockfrostPreviewApiKey, setBlockfrostPreviewApiKey] = useState<string>("");
  const [shouldScanForAddresses, setShouldScanForAddresses] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get(defaultOptions, (it) => {
      const items = it as IOptions;
      if (items.blockfrostApiKey) {
        setBlockfrostMainnetApiKey(items.blockfrostApiKey);
      } else {
        setBlockfrostMainnetApiKey(items.blockfrostMainnetApiKey);
      }
      setBlockfrostPreviewApiKey(items.blockfrostPreviewApiKey);
      setShouldScanForAddresses(items.shouldScanForAddresses);
    });
  }, []);

  const saveOptions = () => {
    chrome.storage.sync.set(
      {
        blockfrostApiKey: undefined,
        blockfrostMainnetApiKey,
        blockfrostPreviewApiKey,
        shouldScanForAddresses,
      },
      () => {
        setShowSuccess(true);
      }
    );
  };

  return (
    <ThemeProvider theme={sorbetTheme}>
      <CssBaseline />
      <Container maxWidth="sm" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h2" gutterBottom>
            Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure your Sorbet extension preferences
          </Typography>
        </Box>

        {/* API Configuration */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <KeyIcon sx={{ color: "primary.main" }} />
            <Typography variant="h3">API Configuration</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter your Blockfrost API keys to enable address lookups and handle resolution.
            Get free keys at{" "}
            <a
              href="https://blockfrost.io"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#7C3AED" }}
            >
              blockfrost.io
            </a>
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              fullWidth
              label="Mainnet API Key"
              placeholder="mainnetXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              value={blockfrostMainnetApiKey}
              onChange={(e) => setBlockfrostMainnetApiKey(e.target.value)}
              type="password"
              InputProps={{
                sx: { fontFamily: "monospace" },
              }}
            />
            <TextField
              fullWidth
              label="Preview (Testnet) API Key"
              placeholder="previewXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              value={blockfrostPreviewApiKey}
              onChange={(e) => setBlockfrostPreviewApiKey(e.target.value)}
              type="password"
              InputProps={{
                sx: { fontFamily: "monospace" },
              }}
            />
          </Box>
        </Paper>

        {/* Behavior Settings */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <VisibilityIcon sx={{ color: "primary.main" }} />
            <Typography variant="h3">Behavior</Typography>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 1,
            }}
          >
            <Box>
              <Typography variant="body1" fontWeight={500}>
                Scan for Addresses
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Automatically detect and highlight Cardano addresses on pages
              </Typography>
            </Box>
            <Switch
              checked={shouldScanForAddresses}
              onChange={(e) => setShouldScanForAddresses(e.target.checked)}
            />
          </Box>
        </Paper>

        {/* Save Button */}
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={saveOptions}
          startIcon={<CheckIcon />}
        >
          Save Settings
        </Button>

        {/* Success Snackbar */}
        <Snackbar
          open={showSuccess}
          autoHideDuration={2000}
          onClose={() => setShowSuccess(false)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity="success" onClose={() => setShowSuccess(false)}>
            Settings saved successfully
          </Alert>
        </Snackbar>
      </Container>
    </ThemeProvider>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
