import KeyIcon from "@mui/icons-material/VpnKey";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import PersonIcon from "@mui/icons-material/PersonOutline";
import LayersIcon from "@mui/icons-material/Layers";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ClearIcon from "@mui/icons-material/Clear";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import PowerIcon from "@mui/icons-material/Power";
import PowerOffIcon from "@mui/icons-material/PowerOff";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AddressAutoComplete } from "./components/address-autocomplete";
import { AddressBookComponent } from "./components/address-book";
import { BottomNav } from "./components/layout/BottomNav";
import { Header } from "./components/layout/Header";
import { P2P_PopupButton } from "./components/p2p/p2p-popup-button";
import { ToolsTab } from "./components/tools/ToolsTab";
import { WalletSelect } from "./components/wallet-select";
import {
  addItemToAddressBook,
  addOrUpdateItemInAddressBook,
  deleteFromAddressBook,
  parseAddressBookFromStorage,
} from "./modules/addressBookStorage";
import { defaultOptions } from "./options";
import { sorbetTheme } from "./theme";
import { AddressBook, AddressBookItem, EView, EWalletType } from "./types";
import { isValidAddress } from "./utils/addresses";
import { Log } from "./utils/log_util";
import { P2PStorageKeys, getFromStorage, makeStorageChangeListener } from "./utils/storage";

const DEFAULT_WALLET_TYPE = EWalletType.IMPERSONATE;

// Map old view values to new ones for migration
const migrateView = (oldView: string): EView => {
  const viewMap: Record<string, EView> = {
    override: EView.WALLET,
    debug: EView.WALLET,
    addressbook: EView.CONTACTS,
    p2p_connect: EView.CONNECT,
    utxo_builder: EView.TOOLS,
    logviewer: EView.TOOLS,
  };
  return viewMap[oldView] || EView.WALLET;
};

const Popup = () => {
  const [view, _setView] = useState<EView>(EView.WALLET);
  const [showSettings, setShowSettings] = useState(false);
  const [isP2PConnected, setIsP2PConnected] = useState(false);

  const setView = (v: EView) => {
    _setView(v);
    chrome.storage.sync.set({ historyTab: v });
  };

  const [walletType, setWalletType] = useState<EWalletType>(DEFAULT_WALLET_TYPE);
  const [impersonatedAddress, _setImpersonatedAddress] = useState<string>("");
  const [impersonatedAddressIsValid, _setImpersonatedAddressIsValid] = useState(false);
  const setImpersonatedAddress = (a: string) => {
    _setImpersonatedAddress(a);
    _setImpersonatedAddressIsValid(isValidAddress(a));
  };
  const [addressBook, setAddressBook] = useState<AddressBook>([]);
  const [wrapWallet, setWrapWallet] = useState<string>("none");
  const [overrideWallet, setOverrideWallet] = useState<string>("none");
  const [isOverridden, setIsOverridden] = useState<boolean>(false);

  // Load initial state from storage
  useEffect(() => {
    chrome.storage.sync.get(
      ["impersonatedAddress", "addressBook", "walletType", "wrapWallet", "overrideWallet", "historyTab"],
      (result) => {
        const savedView = result.historyTab;
        setView(savedView ? migrateView(savedView) : EView.WALLET);
        setWalletType(result.walletType ?? walletType);
        setImpersonatedAddress(result.impersonatedAddress ?? "");
        setAddressBook(parseAddressBookFromStorage(result) ?? []);
        setWrapWallet(result.wrapWallet ?? "none");
        setOverrideWallet(result.overrideWallet ?? "none");
        if (result.overrideWallet && result.overrideWallet !== "none") {
          setIsOverridden(true);
        }
      }
    );
  }, []);

  // Listen for P2P connection status
  useEffect(() => {
    const listener = makeStorageChangeListener(
      P2PStorageKeys.P2P_IS_CONNECTED,
      (connected: boolean) => setIsP2PConnected(connected),
      true,
      ""
    );
    return () => listener();
  }, []);

  // Listen for impersonated address changes from other sources
  useEffect(() => {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.impersonatedAddress?.newValue !== impersonatedAddress) {
        setImpersonatedAddress(changes.impersonatedAddress?.newValue ?? "");
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [impersonatedAddress]);

  const updateWalletType = (newValue: EWalletType) => {
    chrome.storage.sync.set({ walletType: newValue }, () => setWalletType(newValue));
  };

  const updateWrapWallet = (newValue: string) => {
    chrome.storage.sync.set({ wrapWallet: newValue }, () => setWrapWallet(newValue));
  };

  const updateOverrideWallet = (newValue: string) => {
    chrome.storage.sync.set({ overrideWallet: newValue }, () => setOverrideWallet(newValue));
  };

  const updateIsOverridden = (newValue: boolean) => {
    if (!newValue) updateOverrideWallet("none");
    setIsOverridden(newValue);
  };

  const clearImpersonateWallet = () => {
    chrome.storage.sync.set({ impersonatedAddress: "" }, () => setImpersonatedAddress(""));
  };

  const lookupHandle = async (handle: string) => {
    const { blockfrostApiKey } = await getFromStorage("blockfrostApiKey");
    const headers: Record<string, string> = blockfrostApiKey ? { project_id: blockfrostApiKey } : {};
    const blockfrostUrl = "https://cardano-mainnet.blockfrost.io";
    const policyId = "f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a";
    const handleHex = Buffer.from(handle).toString("hex");

    const res = await fetch(
      new URL(`/api/v0/assets/${policyId}${handleHex}/addresses`, blockfrostUrl),
      { method: "GET", headers }
    );
    const addresses = await res.json();
    if (addresses.length > 1) {
      Log.W("Found multiple addresses for handle", handle);
      return undefined;
    }
    return addresses[0]?.address;
  };

  const updateImpersonatedWallet = (newValue: string) => {
    chrome.storage.sync.set({ impersonatedAddress: newValue }, () => setImpersonatedAddress(newValue));
  };

  const finalizeImpersonatedWallet = async (newValue: string) => {
    if (newValue.startsWith("$")) {
      const resolved = await lookupHandle(newValue.slice(1));
      if (resolved) newValue = resolved;
    }
    updateImpersonatedWallet(newValue);
  };

  const addToAddressBook = (newValue: string) => addItemToAddressBook(newValue, setAddressBook);
  const addOrUpdateAddressBookItem = (newItem: AddressBookItem) =>
    addOrUpdateItemInAddressBook(newItem, (newAddressBook) => setAddressBook([...newAddressBook]));
  const removeFromAddressBook = (valueToRemove: string) =>
    deleteFromAddressBook(valueToRemove, setAddressBook);

  return (
    <ThemeProvider theme={sorbetTheme}>
      <CssBaseline />
      <Container
        disableGutters
        sx={{
          width: 440,
          height: 600,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          bgcolor: "background.default",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <Header
          showBack={showSettings}
          title={showSettings ? "Settings" : undefined}
          onBack={() => setShowSettings(false)}
          onSettingsClick={() => setShowSettings(true)}
        />

        {/* Settings Screen */}
        {showSettings ? (
          <SettingsScreen />
        ) : (
          <>
            {/* Content Area */}
            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                px: 2,
                py: 2,
                pb: 10,
              }}
            >
              {/* Wallet Tab */}
              {view === EView.WALLET && (
                <WalletTab
                  walletType={walletType}
                  updateWalletType={updateWalletType}
                  impersonatedAddress={impersonatedAddress}
                  impersonatedAddressIsValid={impersonatedAddressIsValid}
                  updateImpersonatedWallet={updateImpersonatedWallet}
                  finalizeImpersonatedWallet={finalizeImpersonatedWallet}
                  clearImpersonateWallet={clearImpersonateWallet}
                  addressBook={addressBook}
                  addToAddressBook={addToAddressBook}
                  removeFromAddressBook={removeFromAddressBook}
                  addOrUpdateAddressBookItem={addOrUpdateAddressBookItem}
                  wrapWallet={wrapWallet}
                  updateWrapWallet={updateWrapWallet}
                  isOverridden={isOverridden}
                  updateIsOverridden={updateIsOverridden}
                  overrideWallet={overrideWallet}
                  updateOverrideWallet={updateOverrideWallet}
                />
              )}

              {view === EView.CONTACTS && (
                <AddressBookComponent
                  addressBook={addressBook}
                  removeFromAddressBook={removeFromAddressBook}
                  addOrUpdateAddressBookItem={addOrUpdateAddressBookItem}
                  impersonatedAddress={impersonatedAddress}
                  setImpersonatedAddress={updateImpersonatedWallet}
                />
              )}

              {view === EView.CONNECT && <P2P_PopupButton />}

              {view === EView.TOOLS && <ToolsTab />}
            </Box>

            <BottomNav value={view} onChange={setView} isConnected={isP2PConnected} />
          </>
        )}
      </Container>
    </ThemeProvider>
  );
};

// Wallet Tab Component - Redesigned UX
interface WalletTabProps {
  walletType: EWalletType;
  updateWalletType: (type: EWalletType) => void;
  impersonatedAddress: string;
  impersonatedAddressIsValid: boolean;
  updateImpersonatedWallet: (address: string) => void;
  finalizeImpersonatedWallet: (address: string) => void;
  clearImpersonateWallet: () => void;
  addressBook: AddressBook;
  addToAddressBook: (address: string) => void;
  removeFromAddressBook: (address: string) => void;
  addOrUpdateAddressBookItem: (item: AddressBookItem) => void;
  wrapWallet: string;
  updateWrapWallet: (wallet: string) => void;
  isOverridden: boolean;
  updateIsOverridden: (value: boolean) => void;
  overrideWallet: string;
  updateOverrideWallet: (wallet: string) => void;
}

const WalletTab: React.FC<WalletTabProps> = ({
  walletType,
  updateWalletType,
  impersonatedAddress,
  impersonatedAddressIsValid,
  updateImpersonatedWallet,
  finalizeImpersonatedWallet,
  clearImpersonateWallet,
  addressBook,
  addToAddressBook,
  removeFromAddressBook,
  wrapWallet,
  updateWrapWallet,
  isOverridden,
  updateIsOverridden,
  overrideWallet,
  updateOverrideWallet,
}) => {
  const isActive = impersonatedAddress || (isOverridden && overrideWallet !== "none");
  const isInAddressBook = addressBook.some(a => a.address === impersonatedAddress);
  const contactName = addressBook.find(a => a.address === impersonatedAddress)?.name;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        updateImpersonatedWallet(text.trim());
        finalizeImpersonatedWallet(text.trim());
      }
    } catch (err) {
      console.error("Failed to paste:", err);
    }
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
          bgcolor: isActive ? "primary.50" : "grey.100",
          border: "1px solid",
          borderColor: isActive ? "primary.200" : "grey.200",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {isActive ? (
            <PowerIcon sx={{ color: "primary.main", fontSize: 20 }} />
          ) : (
            <PowerOffIcon sx={{ color: "grey.400", fontSize: 20 }} />
          )}
          <Box>
            <Typography variant="body2" fontWeight={600} color={isActive ? "primary.main" : "text.secondary"}>
              {isActive ? "Sorbet Active" : "Sorbet Inactive"}
            </Typography>
            {impersonatedAddress && (
              <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
                {contactName || `${impersonatedAddress.slice(0, 12)}...${impersonatedAddress.slice(-6)}`}
              </Typography>
            )}
          </Box>
        </Box>
        <Chip
          size="small"
          icon={isActive ? <CheckCircleIcon sx={{ fontSize: "14px !important" }} /> : undefined}
          label={isActive ? "On" : "Off"}
          sx={{
            bgcolor: isActive ? "primary.main" : "grey.300",
            color: "white",
            fontWeight: 600,
            "& .MuiChip-icon": { color: "white" },
          }}
        />
      </Box>

      {/* Mode Toggle */}
      <Box>
        <ToggleButtonGroup
          value={walletType}
          exclusive
          onChange={(_, value) => value && updateWalletType(value)}
          fullWidth
          size="small"
          sx={{
            bgcolor: "grey.100",
            p: 0.5,
            borderRadius: 2,
            "& .MuiToggleButton-root": {
              border: "none",
              borderRadius: "6px !important",
              py: 1,
              textTransform: "none",
              fontWeight: 500,
              color: "text.secondary",
              "&.Mui-selected": {
                bgcolor: "white",
                color: "primary.main",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                "&:hover": { bgcolor: "white" },
              },
              "&:hover": { bgcolor: "transparent" },
            },
          }}
        >
          <ToggleButton value={EWalletType.IMPERSONATE}>
            <PersonIcon sx={{ fontSize: 18, mr: 0.75 }} />
            Impersonate
          </ToggleButton>
          <ToggleButton value={EWalletType.WRAP}>
            <LayersIcon sx={{ fontSize: 18, mr: 0.75 }} />
            Wrap Wallet
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Address Input - Impersonate Mode */}
      {walletType === EWalletType.IMPERSONATE && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2,
            border: "1px solid",
            borderColor: impersonatedAddress ? (impersonatedAddressIsValid ? "primary.200" : "error.200") : "grey.200",
            bgcolor: impersonatedAddress ? (impersonatedAddressIsValid ? "primary.50" : "error.50") : "white",
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Enter or paste a Cardano address..."
            value={impersonatedAddress}
            onChange={(e) => updateImpersonatedWallet(e.target.value)}
            onBlur={(e) => finalizeImpersonatedWallet(e.target.value)}
            error={!!impersonatedAddress && !impersonatedAddressIsValid}
            helperText={impersonatedAddress && !impersonatedAddressIsValid ? "Invalid address format" : ""}
            InputProps={{
              sx: { fontFamily: "monospace", fontSize: 13, bgcolor: "white" },
              endAdornment: (
                <InputAdornment position="end">
                  {!impersonatedAddress ? (
                    <Tooltip title="Paste from clipboard">
                      <IconButton size="small" onClick={handlePaste} edge="end">
                        <ContentPasteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Box sx={{ display: "flex", gap: 0.25 }}>
                      <Tooltip title={isInAddressBook ? "Saved to contacts" : "Save to contacts"}>
                        <IconButton
                          size="small"
                          disabled={!impersonatedAddressIsValid}
                          onClick={() => {
                            if (isInAddressBook) {
                              removeFromAddressBook(impersonatedAddress);
                            } else {
                              addToAddressBook(impersonatedAddress);
                            }
                          }}
                          sx={{ color: isInAddressBook ? "primary.main" : "grey.400" }}
                        >
                          {isInAddressBook ? <BookmarkIcon sx={{ fontSize: 18 }} /> : <BookmarkBorderIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Clear">
                        <IconButton size="small" onClick={clearImpersonateWallet} sx={{ color: "grey.400" }}>
                          <ClearIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </InputAdornment>
              ),
            }}
          />

          {/* Quick Contacts */}
          {!impersonatedAddress && addressBook.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: "block" }}>
                Recent contacts
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {addressBook.slice(0, 4).map((contact) => (
                  <Chip
                    key={contact.address}
                    label={contact.name || `${contact.address.slice(0, 8)}...`}
                    size="small"
                    onClick={() => {
                      updateImpersonatedWallet(contact.address);
                      finalizeImpersonatedWallet(contact.address);
                    }}
                    sx={{
                      bgcolor: "white",
                      border: "1px solid",
                      borderColor: "grey.200",
                      cursor: "pointer",
                      "&:hover": { borderColor: "primary.main", bgcolor: "primary.50" },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Contact Label */}
          {contactName && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1 }}>
              <BookmarkIcon sx={{ fontSize: 14, color: "primary.main" }} />
              <Typography variant="caption" color="primary.main" fontWeight={500}>
                {contactName}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Wallet Select - Wrap Mode */}
      {walletType === EWalletType.WRAP && (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "grey.200" }}>
          <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ mb: 1, display: "block" }}>
            Select wallet to extend
          </Typography>
          <WalletSelect wallet={wrapWallet} onChange={updateWrapWallet} />
        </Paper>
      )}

      {/* Override Section */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: isOverridden ? "primary.200" : "grey.200",
          bgcolor: isOverridden ? "primary.50" : "white",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: isOverridden ? "primary.100" : "grey.100" }}>
              <SwapHorizIcon sx={{ fontSize: 18, color: isOverridden ? "primary.main" : "grey.500" }} />
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                Override Wallet
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Replace dApp's connected wallet
              </Typography>
            </Box>
          </Box>
          <Switch
            checked={isOverridden}
            onChange={(e) => updateIsOverridden(e.target.checked)}
            size="small"
          />
        </Box>
        {isOverridden && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid", borderColor: "grey.200" }}>
            <WalletSelect label="" wallet={overrideWallet} onChange={updateOverrideWallet} />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

// Settings Screen Component
const SettingsScreen: React.FC = () => {
  const [blockfrostMainnetApiKey, setBlockfrostMainnetApiKey] = useState("");
  const [blockfrostPreviewApiKey, setBlockfrostPreviewApiKey] = useState("");
  const [shouldScanForAddresses, setShouldScanForAddresses] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get(defaultOptions, (it) => {
      const items = it as typeof defaultOptions;
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
      () => setShowSuccess(true)
    );
  };

  return (
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        px: 2,
        py: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {/* API Configuration */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <KeyIcon sx={{ color: "primary.main", fontSize: 20 }} />
          <Typography variant="body1" fontWeight={600}>
            API Keys
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
          Enter your Blockfrost API keys for address lookups.{" "}
          <a href="https://blockfrost.io" target="_blank" rel="noopener noreferrer" style={{ color: "#7C3AED" }}>
            Get free keys
          </a>
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            label="Mainnet API Key"
            placeholder="mainnetXXXXXXXX..."
            value={blockfrostMainnetApiKey}
            onChange={(e) => setBlockfrostMainnetApiKey(e.target.value)}
            type="password"
            InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }}
          />
          <TextField
            fullWidth
            size="small"
            label="Preview API Key"
            placeholder="previewXXXXXXXX..."
            value={blockfrostPreviewApiKey}
            onChange={(e) => setBlockfrostPreviewApiKey(e.target.value)}
            type="password"
            InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }}
          />
        </Box>
      </Paper>

      {/* Behavior Settings */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <VisibilityIcon sx={{ color: "primary.main", fontSize: 20 }} />
          <Typography variant="body1" fontWeight={600}>
            Behavior
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              Scan for Addresses
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Auto-detect Cardano addresses on pages
            </Typography>
          </Box>
          <Switch
            checked={shouldScanForAddresses}
            onChange={(e) => setShouldScanForAddresses(e.target.checked)}
          />
        </Box>
      </Paper>

      {/* Save Button */}
      <Button variant="contained" fullWidth onClick={saveOptions}>
        Save Settings
      </Button>

      <Snackbar
        open={showSuccess}
        autoHideDuration={2000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          Settings saved
        </Alert>
      </Snackbar>
    </Box>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
