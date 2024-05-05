import React, { useEffect, useState } from "react";
import DebugIcon from "@mui/icons-material/Analytics";
import AddressBookIcon from "@mui/icons-material/MenuBook";
import LogViewerIcon from "@mui/icons-material/DocumentScanner";
import UtXOBuilderIcon from "@mui/icons-material/ListAlt";
import OverrideIcon from "@mui/icons-material/Settings";
import {
  InputLabel, Stack, Switch, ToggleButton, ToggleButtonGroup, Box,
  Button, Container, CssBaseline, MenuItem, TextField, Typography,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { createRoot } from "react-dom/client";
import { EView, EWalletType, AddressBook, AddressBookItem } from "./types";
import { WalletSelect } from "./components/wallet-select";
import { AddressBookComponent } from "./components/address-book";
import { AddressAutoComplete, autocompleteThemeOverrides } from "./components/address-autocomplete";
import { getFromStorage } from "./utils/storage";
import { isValidAddress } from "./utils/addresses";
import { LogViewerComponent } from "./components/log-viewer";
import { addItemToAddressBook, addOrUpdateItemInAddressBook, deleteFromAddressBook, parseAddressBookFromStorage } from "./modules/addressBookStorage";
import { useCustomResponse } from "./hooks/useCustomResponse";

const theme = createTheme({ ...autocompleteThemeOverrides });

const DEFAULT_WALLET_TYPE = EWalletType.IMPERSONATE

const Popup = () => {
  const [view, setView] = useState<EView>(EView.OVERRIDE);
  const [walletType, setWalletType] = useState<EWalletType>(DEFAULT_WALLET_TYPE);
  const [impersonatedAddress, _setImpersonatedAddress] = useState<string>("");
  const [impersonatedAddressIsValid, _setImpersonatedAddressIsValid] = useState(false);
  const setImpersonatedAddress = (a: string) => {
    _setImpersonatedAddress(a)
    _setImpersonatedAddressIsValid(isValidAddress(a))
  }
  const [addressBook, setAddressBook] = useState<AddressBook>([]);
  const [wrapWallet, setWrapWallet] = useState<string>("none");
  const [overrideWallet, setOverrideWallet] = useState<string>("none");
  const [isOverridden, setIsOverridden] = useState<Boolean>(false);

  useEffect(() => {
    chrome.storage.sync.get(
      ["impersonatedAddress", "addressBook", "walletType", "wrapWallet", "overrideWallet"],
      function (result) {
        setWalletType(result.walletType ?? walletType);
        setImpersonatedAddress(result.impersonatedAddress ?? impersonatedAddress);
        setAddressBook(parseAddressBookFromStorage(result) ?? addressBook);
        setWrapWallet(result.wrapWallet ?? wrapWallet);
        setOverrideWallet(result.overrideWallet ?? overrideWallet);
        if (result.overrideWallet !== 'none') {
          console.log('setOverridden')
          setIsOverridden(true);
        }
      }
    );
  }, []);

  useEffect(() => {
    const storageChangedListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      // console.log("changes", changes); // {key : { newValue: 'value' }}
      const shouldUpdateState = changes.impersonatedAddress && changes.impersonatedAddress.newValue !== impersonatedAddress
      if (shouldUpdateState) {
        setImpersonatedAddress(changes.impersonatedAddress.newValue)
      }
    }
    chrome.storage.onChanged.addListener(storageChangedListener)
    return () => {
      chrome.storage.onChanged.removeListener(storageChangedListener);
    };
  }, [])

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
    console.log('Sorbet: overriding wallet to', newValue)
    chrome.storage.sync.set({ overrideWallet: newValue }, function () {
      console.log('Sorbet: persisted overrideWallet to sync', newValue)
      setOverrideWallet(newValue ?? "");
    });
  };

  const updateIsOverridden = (newValue: boolean) => {
    console.log("Sorbet: updateIsOverridden", newValue)
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
  const addToAddressBook = (newValue: string): void => addItemToAddressBook(newValue, setAddressBook)
  
  const addOrUpdateAddressBookItem = (newItem: AddressBookItem) => 
    addOrUpdateItemInAddressBook(newItem, (newAddressBook) => { setAddressBook([...newAddressBook]) })
  
  const removeFromAddressBook = (valueToRemove: string) => deleteFromAddressBook(valueToRemove, setAddressBook)
  
  return (
    <ThemeProvider theme={theme}>
      <Container component="main" style={{ width: 440, minHeight: 440 }}>
        <CssBaseline />
        <Header title="Sorbet Settings" />
        <MenuBar {...{ view, setView }} />
        <Box
          sx={{
            ...boxStyles,
            alignItems: "left",
          }}
        >
          <WalletStatus {...{walletType, isOverridden, overrideWallet}} />
          {EView.OVERRIDE === view && (
            <>
              <TextField
                select
                fullWidth
                label="Wallet Type"
                value={walletType}
                style={{ marginBottom: 12 }}
                onChange={(e) => updateWalletType(e.target.value as EWalletType)}
              >
                <MenuItem value="impersonate">Impersonate</MenuItem>
                <MenuItem value="wrap">Wrap</MenuItem>
              </TextField>
              {EWalletType.IMPERSONATE === walletType ? (
                <>
                  <AddressAutoComplete {...{
                    addressBook, impersonatedAddress, impersonatedAddressIsValid,
                    updateImpersonatedWallet, finalizeImpersonatedWallet,
                    addToAddressBook, removeFromAddressBook, addOrUpdateAddressBookItem
                  }} />
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
        {(EView.OVERRIDE === view || EView.DEBUG === view) && (
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
        )}
        {isOverridden && (EView.OVERRIDE === view || EView.DEBUG === view) && (
          <WalletSelect label="" wallet={overrideWallet} onChange={updateOverrideWallet} />
        )}
        {EView.ADDRESS_BOOK === view && (
          <AddressBookComponent {...{
            addressBook, removeFromAddressBook, addOrUpdateAddressBookItem,
            impersonatedAddress
          }}
            setImpersonatedAddress={updateImpersonatedWallet}
          />
        )}
        {EView.LOG_VIEWER === view && (
          <LogViewerComponent />
        )}
      </Container>
    </ThemeProvider>
  );
};

/** Component to Display Wallet Status */
interface WalletStatusProps { walletType: EWalletType, isOverridden: Boolean, overrideWallet: string }
const WalletStatus = ({ walletType, isOverridden, overrideWallet }: WalletStatusProps) => (
  <Typography sx={{marginBottom: 2}} component="p" variant="body2" >
    <b>Wallet Status:</b> {walletType} {isOverridden ? "" : "NOT"} overriden {overrideWallet}
  </Typography>
)

const boxStyles = {
  marginTop: 2,
  display: "flex",
  flexDirection: "column",
}

/** Simple Header Bar */
const Header = ({ title }: { title: string }) => (
  <Box
    sx={{
      ...boxStyles,
      alignItems: "center",
    }}
  >
    <Typography component="h1" variant="h5" fontWeight="bold">
      {title}
    </Typography>
  </Box>
)

/** Simple Menu Bar Component with switch state managed externally  */
const MenuBar = ({ view, setView }: { view: EView, setView: (v: EView) => void }) => {

  const { isCustomResponseEnabled } = useCustomResponse()
  return (
    <Stack direction="row" spacing={4} sx={{ marginTop: 2 }}>
      <ToggleButtonGroup
        value={view}
        exclusive
        fullWidth
        onChange={(e, value) => setView(value ?? view ?? EView.OVERRIDE)}
        aria-label="text alignment"
      >
        <ToggleButton value={EView.OVERRIDE} aria-label="right aligned">
          <OverrideIcon />
        </ToggleButton>
        <ToggleButton value={EView.DEBUG} aria-label="center aligned">
          <DebugIcon />
        </ToggleButton>
        <ToggleButton value={EView.ADDRESS_BOOK} aria-label="center aligned">
          <AddressBookIcon />
        </ToggleButton>
        <ToggleButton value={EView.UTXO_BUILDER} aria-label="center aligned">
          {isCustomResponseEnabled ? <UtXOBuilderIcon color="primary" /> : <UtXOBuilderIcon />}
        </ToggleButton>
        <ToggleButton value={EView.LOG_VIEWER} aria-label="left aligned">
          <LogViewerIcon />
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  )
}

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
