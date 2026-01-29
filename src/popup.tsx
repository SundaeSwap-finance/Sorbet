import KeyIcon from "@mui/icons-material/VpnKey";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PersonIcon from "@mui/icons-material/PersonOutline";
import LayersIcon from "@mui/icons-material/Layers";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ClearIcon from "@mui/icons-material/Clear";
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  Container,
  CssBaseline,
  IconButton,
  Paper,
  Snackbar,
  Switch,
  TextField,
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
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  {/* Status Hero */}
                  <WalletStatusCard
                    walletType={walletType}
                    isOverridden={isOverridden}
                    overrideWallet={overrideWallet}
                    impersonatedAddress={impersonatedAddress}
                  />

                  {/* Mode Selector */}
                  <Box>
                    <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: "block" }}>
                      Mode
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <ModeCard
                        icon={<PersonIcon />}
                        label="Impersonate"
                        description="Use any address"
                        selected={walletType === EWalletType.IMPERSONATE}
                        onClick={() => updateWalletType(EWalletType.IMPERSONATE)}
                      />
                      <ModeCard
                        icon={<LayersIcon />}
                        label="Wrap"
                        description="Extend a wallet"
                        selected={walletType === EWalletType.WRAP}
                        onClick={() => updateWalletType(EWalletType.WRAP)}
                      />
                    </Box>
                  </Box>

                  {/* Impersonate Mode */}
                  {walletType === EWalletType.IMPERSONATE && (
                    <Box>
                      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: "block" }}>
                        Address
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <AddressAutoComplete
                            addressBook={addressBook}
                            impersonatedAddress={impersonatedAddress}
                            impersonatedAddressIsValid={impersonatedAddressIsValid}
                            updateImpersonatedWallet={updateImpersonatedWallet}
                            finalizeImpersonatedWallet={finalizeImpersonatedWallet}
                            addToAddressBook={addToAddressBook}
                            removeFromAddressBook={removeFromAddressBook}
                            addOrUpdateAddressBookItem={addOrUpdateAddressBookItem}
                          />
                        </Box>
                        {impersonatedAddress && (
                          <Tooltip title="Clear address">
                            <IconButton
                              size="small"
                              onClick={clearImpersonateWallet}
                              sx={{
                                mt: 0.5,
                                bgcolor: "grey.100",
                                color: "text.secondary",
                                "&:hover": { bgcolor: "grey.200" },
                              }}
                            >
                              <ClearIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* Wrap Mode */}
                  {walletType === EWalletType.WRAP && (
                    <Box>
                      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: "block" }}>
                        Base Wallet
                      </Typography>
                      <WalletSelect wallet={wrapWallet} onChange={updateWrapWallet} />
                    </Box>
                  )}

                  {/* Override Toggle */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      borderColor: isOverridden ? "primary.200" : "grey.200",
                      bgcolor: isOverridden ? "primary.50" : "transparent",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ width: 36, height: 36, bgcolor: isOverridden ? "primary.100" : "grey.100" }}>
                          <SwapHorizIcon sx={{ fontSize: 20, color: isOverridden ? "primary.main" : "grey.500" }} />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            Override Wallet
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Replace connected wallet
                          </Typography>
                        </Box>
                      </Box>
                      <Switch checked={isOverridden} onChange={(e) => updateIsOverridden(e.target.checked)} />
                    </Box>
                    {isOverridden && (
                      <Box sx={{ mt: 2 }}>
                        <WalletSelect label="" wallet={overrideWallet} onChange={updateOverrideWallet} />
                      </Box>
                    )}
                  </Paper>
                </Box>
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

// Mode Card Component
interface ModeCardProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

const ModeCard: React.FC<ModeCardProps> = ({ icon, label, description, selected, onClick }) => (
  <ButtonBase
    onClick={onClick}
    sx={{
      flex: 1,
      p: 2,
      borderRadius: 3,
      border: "2px solid",
      borderColor: selected ? "primary.main" : "grey.200",
      bgcolor: selected ? "primary.50" : "white",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 0.5,
      transition: "all 0.2s",
      "&:hover": {
        borderColor: selected ? "primary.main" : "grey.300",
        bgcolor: selected ? "primary.50" : "grey.50",
      },
    }}
  >
    <Avatar
      sx={{
        width: 40,
        height: 40,
        bgcolor: selected ? "primary.main" : "grey.100",
        color: selected ? "white" : "grey.600",
        mb: 0.5,
      }}
    >
      {icon}
    </Avatar>
    <Typography variant="body2" fontWeight={600} color={selected ? "primary.main" : "text.primary"}>
      {label}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {description}
    </Typography>
  </ButtonBase>
);

// Wallet Status Card Component
interface WalletStatusCardProps {
  walletType: EWalletType;
  isOverridden: boolean;
  overrideWallet: string;
  impersonatedAddress: string;
}

const WalletStatusCard: React.FC<WalletStatusCardProps> = ({
  walletType,
  isOverridden,
  overrideWallet,
  impersonatedAddress,
}) => {
  const isActive = impersonatedAddress || (isOverridden && overrideWallet !== "none");

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        background: isActive
          ? "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)"
          : "linear-gradient(135deg, #F4F4F5 0%, #E4E4E7 100%)",
        color: isActive ? "white" : "text.primary",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Avatar
          sx={{
            width: 48,
            height: 48,
            bgcolor: isActive ? "rgba(255,255,255,0.2)" : "white",
            color: isActive ? "white" : "grey.500",
          }}
        >
          <AccountBalanceWalletIcon />
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {isActive ? (
              <CheckCircleIcon sx={{ fontSize: 16 }} />
            ) : (
              <RadioButtonUncheckedIcon sx={{ fontSize: 16, opacity: 0.5 }} />
            )}
            <Typography variant="body1" fontWeight={700}>
              {isActive ? "Active" : "Inactive"}
            </Typography>
          </Box>
          {impersonatedAddress ? (
            <Typography
              variant="caption"
              sx={{
                fontFamily: "monospace",
                opacity: 0.85,
                display: "block",
                mt: 0.25,
              }}
            >
              {impersonatedAddress.slice(0, 16)}...{impersonatedAddress.slice(-6)}
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              No wallet configured
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
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
