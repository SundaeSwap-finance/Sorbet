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
  Chip,
  Container,
  CssBaseline,
  IconButton,
  InputAdornment,
  Paper,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AddressBookComponent } from "./components/address-book";
import { BottomNav } from "./components/layout/BottomNav";
import { Header } from "./components/layout/Header";
import { P2P_PopupButton } from "./components/p2p/p2p-popup-button";
import { SettingsForm } from "./components/settings-form";
import { ToolsTab } from "./components/tools/ToolsTab";
import { WalletSelect } from "./components/wallet-select";
import { HandleResolutionError, resolveHandle } from "./modules/handleResolver";
import {
  addAddress,
  loadAddressBook,
  onAddressBookChanged,
  removeAddress,
} from "./modules/addressBookStorage";
import { loadP2PIsConnected, onP2PIsConnectedChanged } from "./modules/p2pStorage";
import { Settings, loadSettings, onSettingsChanged, saveSettings } from "./settings";
import { sorbetTheme } from "./theme";
import { AddressBook, EView, EWalletType, WALLET_IDS, WalletId } from "./types";
import { isValidAddress } from "./utils/addresses";
import { Log } from "./utils/log_util";

const POPUP_KEYS = ["impersonatedAddress", "walletType", "wrapWallet", "overrideWallet", "historyTab"] as const;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const Popup = () => {
  const [view, _setView] = useState<EView>(EView.WALLET);
  const [showSettings, setShowSettings] = useState(false);
  const [isP2PConnected, setIsP2PConnected] = useState(false);
  const [walletType, setWalletType] = useState<EWalletType>(EWalletType.IMPERSONATE);
  const [impersonatedAddress, setImpersonatedAddress] = useState("");
  const [addressDraft, setAddressDraft] = useState("");
  const [addressBook, setAddressBook] = useState<AddressBook>([]);
  const [wrapWallet, setWrapWallet] = useState<WalletId | null>(null);
  const [overrideWallet, setOverrideWallet] = useState<WalletId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Latest committed address and the newest commit; used to drop stale resolutions and echoes.
  const committedAddress = useRef("");
  const latestCommit = useRef(0);

  const applyAddress = useCallback((address: string) => {
    committedAddress.current = address;
    setImpersonatedAddress(address);
    setAddressDraft(address);
  }, []);

  const persist = useCallback(async (patch: Partial<Settings>): Promise<boolean> => {
    try {
      await saveSettings(patch);
      setError(null);
      return true;
    } catch (e) {
      setError(`Could not save: ${errorMessage(e)}`);
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const fail = (what: string) => (e: unknown) => active && setError(`Could not load ${what}: ${errorMessage(e)}`);
    loadSettings(POPUP_KEYS).then((s) => {
      if (!active) return;
      _setView(s.historyTab);
      setWalletType(s.walletType);
      setWrapWallet(s.wrapWallet);
      setOverrideWallet(s.overrideWallet);
      applyAddress(s.impersonatedAddress);
    }, fail("settings"));
    loadAddressBook().then((book) => active && setAddressBook(book), fail("contacts"));
    loadP2PIsConnected().then((connected) => active && setIsP2PConnected(connected), fail("P2P status"));

    const unsubscribers = [
      onSettingsChanged(["impersonatedAddress"], ({ impersonatedAddress: address }) => {
        if (address !== committedAddress.current) {
          latestCommit.current += 1;
          applyAddress(address);
        }
      }),
      onAddressBookChanged(setAddressBook),
      onP2PIsConnectedChanged(setIsP2PConnected),
    ];
    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [applyAddress]);

  const setView = (v: EView) => {
    _setView(v);
    void persist({ historyTab: v });
  };

  const updateWalletType = async (value: EWalletType) => {
    if (await persist({ walletType: value })) setWalletType(value);
  };

  const updateWrapWallet = async (value: WalletId | null) => {
    if (await persist({ wrapWallet: value })) setWrapWallet(value);
  };

  const updateOverrideWallet = async (value: WalletId | null) => {
    if (await persist({ overrideWallet: value })) setOverrideWallet(value);
  };

  /** Commit an address or `$handle`; keystrokes never reach storage. The newest commit always wins. */
  const commitAddress = async (raw: string) => {
    const value = raw.trim();
    const commit = ++latestCommit.current;
    setAddressError(null);
    if (value === committedAddress.current) {
      setAddressDraft(value);
      return;
    }
    let address = value;
    if (value.startsWith("$")) {
      try {
        const { blockfrostMainnetApiKey } = await loadSettings(["blockfrostMainnetApiKey"]);
        address = await resolveHandle(value.slice(1), blockfrostMainnetApiKey);
      } catch (e) {
        if (commit === latestCommit.current) {
          if (!(e instanceof HandleResolutionError)) Log.E(e, "Handle lookup failed");
          setAddressError(errorMessage(e));
        }
        return;
      }
      if (commit !== latestCommit.current) return;
    }
    if (!(await persist({ impersonatedAddress: address }))) return;
    if (commit === latestCommit.current) applyAddress(address);
  };

  const addToAddressBook = (address: string) => {
    addAddress(address).catch((e) => setError(`Could not save contact: ${errorMessage(e)}`));
  };
  const removeFromAddressBook = (address: string) => {
    removeAddress(address).catch((e) => setError(`Could not remove contact: ${errorMessage(e)}`));
  };

  const isActive =
    overrideWallet !== null ||
    (walletType === EWalletType.IMPERSONATE ? isValidAddress(impersonatedAddress) : wrapWallet !== null);

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
              {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {/* Wallet Tab */}
              {view === EView.WALLET && (
                <WalletTab
                  walletType={walletType}
                  updateWalletType={updateWalletType}
                  isActive={isActive}
                  impersonatedAddress={impersonatedAddress}
                  addressDraft={addressDraft}
                  setAddressDraft={setAddressDraft}
                  addressError={addressError}
                  commitAddress={commitAddress}
                  addressBook={addressBook}
                  addToAddressBook={addToAddressBook}
                  removeFromAddressBook={removeFromAddressBook}
                  wrapWallet={wrapWallet}
                  updateWrapWallet={updateWrapWallet}
                  overrideWallet={overrideWallet}
                  updateOverrideWallet={updateOverrideWallet}
                />
              )}

              {view === EView.CONTACTS && (
                <AddressBookComponent
                  addressBook={addressBook}
                  impersonatedAddress={impersonatedAddress}
                  setImpersonatedAddress={commitAddress}
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
  isActive: boolean;
  impersonatedAddress: string;
  addressDraft: string;
  setAddressDraft: (draft: string) => void;
  addressError: string | null;
  commitAddress: (value: string) => void;
  addressBook: AddressBook;
  addToAddressBook: (address: string) => void;
  removeFromAddressBook: (address: string) => void;
  wrapWallet: WalletId | null;
  updateWrapWallet: (wallet: WalletId | null) => void;
  overrideWallet: WalletId | null;
  updateOverrideWallet: (wallet: WalletId | null) => void;
}

const WalletTab: React.FC<WalletTabProps> = ({
  walletType,
  updateWalletType,
  isActive,
  impersonatedAddress,
  addressDraft,
  setAddressDraft,
  addressError,
  commitAddress,
  addressBook,
  addToAddressBook,
  removeFromAddressBook,
  wrapWallet,
  updateWrapWallet,
  overrideWallet,
  updateOverrideWallet,
}) => {
  const draftAddress = addressDraft.trim();
  const draftIsValid = isValidAddress(draftAddress);
  const isInAddressBook = addressBook.some((a) => a.address === draftAddress);
  const contactName = addressBook.find((a) => a.address === impersonatedAddress)?.name;

  const handlePaste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) commitAddress(text);
    } catch (err) {
      Log.E(err, "Failed to read clipboard");
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
            borderColor: addressDraft ? (draftIsValid ? "primary.200" : "error.200") : "grey.200",
            bgcolor: addressDraft ? (draftIsValid ? "primary.50" : "error.50") : "white",
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Enter or paste a Cardano address, or a $handle..."
            value={addressDraft}
            onChange={(e) => setAddressDraft(e.target.value)}
            onBlur={(e) => commitAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAddress(addressDraft);
            }}
            error={!!addressDraft && !draftIsValid && !addressDraft.trim().startsWith("$")}
            helperText={addressError ?? (addressDraft && !draftIsValid && !addressDraft.trim().startsWith("$") ? "Invalid address format" : "")}
            InputProps={{
              sx: { fontFamily: "monospace", fontSize: 13, bgcolor: "white" },
              endAdornment: (
                <InputAdornment position="end">
                  {!addressDraft ? (
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
                          disabled={!draftIsValid}
                          onClick={() => {
                            if (isInAddressBook) {
                              removeFromAddressBook(draftAddress);
                            } else {
                              addToAddressBook(draftAddress);
                            }
                          }}
                          sx={{ color: isInAddressBook ? "primary.main" : "grey.400" }}
                        >
                          {isInAddressBook ? <BookmarkIcon sx={{ fontSize: 18 }} /> : <BookmarkBorderIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Clear">
                        <IconButton size="small" onClick={() => commitAddress("")} sx={{ color: "grey.400" }}>
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
                {addressBook.slice(-4).reverse().map((contact) => (
                  <Chip
                    key={contact.address}
                    label={contact.name || `${contact.address.slice(0, 8)}...`}
                    size="small"
                    onClick={() => commitAddress(contact.address)}
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
          borderColor: overrideWallet !== null ? "primary.200" : "grey.200",
          bgcolor: overrideWallet !== null ? "primary.50" : "white",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: overrideWallet !== null ? "primary.100" : "grey.100" }}>
              <SwapHorizIcon sx={{ fontSize: 18, color: overrideWallet !== null ? "primary.main" : "grey.500" }} />
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
            checked={overrideWallet !== null}
            onChange={(e) => updateOverrideWallet(e.target.checked ? WALLET_IDS[0] : null)}
            size="small"
          />
        </Box>
        {overrideWallet !== null && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid", borderColor: "grey.200" }}>
            <WalletSelect label="" wallet={overrideWallet} onChange={updateOverrideWallet} />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

// Settings Screen Component
const SettingsScreen: React.FC = () => (
  <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 2 }}>
    <SettingsForm />
  </Box>
);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
