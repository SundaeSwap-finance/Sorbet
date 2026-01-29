import React, { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContactsIcon from "@mui/icons-material/ContactsOutlined";
import TestnetIcon from "@mui/icons-material/BugReport";
import EditIcon from "@mui/icons-material/Edit";
import CopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import MainnetIcon from "@mui/icons-material/CheckCircle";
import ExclamIcon from "@mui/icons-material/ErrorOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Check";
import { isValidAddress } from "../utils/addresses";
import { AddressBook, AddressBookItem } from "../types";

interface AddressBookItemActions {
  setImpersonatedAddress: (a: string) => void;
}
interface AddressBookProps extends AddressBookItemActions {
  addressBook: AddressBook;
  impersonatedAddress: string;
  removeFromAddressBook: (a: string) => void;
  addOrUpdateAddressBookItem: (abe: AddressBookItem) => void;
}

interface EditMode {
  i: number;
  name: string;
}

/** MAIN AddressBook Component */
export const AddressBookComponent = (props: AddressBookProps): JSX.Element => {
  const { addressBook, impersonatedAddress, setImpersonatedAddress, addOrUpdateAddressBookItem } =
    props;
  const [editModes, setEditModes] = useState<EditMode[]>([]);
  const [newAddress, setNewAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);

  const getEditMode = (i: number): EditMode | undefined => editModes.find((em) => em.i === i);
  const enableEditMode = (i: number, initialName?: string): void => {
    setEditModes([...editModes, { i, name: initialName ?? "" }]);
  };
  const disableEditMode = (i: number): void => {
    setEditModes([...editModes].filter((em) => em.i !== i));
  };
  const setIsInEditMode = (i: number, newIsInEditMode: boolean, initialName?: string): void => {
    if (!newIsInEditMode) {
      disableEditMode(i);
    } else {
      enableEditMode(i, initialName);
    }
  };
  const saveCurrentName = (i: number): void => {
    const editMode = getEditMode(i);
    if (editMode) {
      const abe = addressBook[i];
      addOrUpdateAddressBookItem({ ...abe, name: editMode.name });
      setIsInEditMode(i, false);
    }
  };
  const nameInputOnChange = (i: number, name: string): void => {
    const newEditModes = [...editModes].map((em) => (em.i === i ? { i, name } : em));
    setEditModes(newEditModes);
  };

  const handleAddAddress = () => {
    if (!newAddress.trim()) return;

    if (!isValidAddress(newAddress.trim())) {
      setAddressError("Invalid bech32 address format");
      return;
    }

    addOrUpdateAddressBookItem({ address: newAddress.trim() });
    setNewAddress("");
    setAddressError(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddAddress();
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Add New Address */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          border: "2px dashed",
          borderColor: newAddress ? "primary.main" : "grey.200",
          borderRadius: 3,
          bgcolor: newAddress ? "primary.50" : "grey.50",
          transition: "all 0.2s",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <AddIcon sx={{ color: "primary.main", fontSize: 20 }} />
          <Typography variant="body2" fontWeight={600}>
            Add Contact
          </Typography>
        </Box>
        <TextField
          fullWidth
          size="small"
          placeholder="Paste Cardano address..."
          value={newAddress}
          onChange={(e) => {
            setNewAddress(e.target.value);
            setAddressError(null);
          }}
          onKeyPress={handleKeyPress}
          error={!!addressError}
          helperText={addressError}
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: "white",
              fontFamily: "monospace",
              fontSize: 13,
            },
          }}
        />
        <Button
          fullWidth
          variant="contained"
          disabled={!newAddress.trim()}
          onClick={handleAddAddress}
          sx={{ mt: 1.5 }}
        >
          Save Contact
        </Button>
      </Paper>

      {/* Contact List */}
      {addressBook.length === 0 ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 5,
          }}
        >
          <Avatar sx={{ width: 64, height: 64, bgcolor: "grey.100", mb: 2 }}>
            <ContactsIcon sx={{ fontSize: 32, color: "grey.400" }} />
          </Avatar>
          <Typography variant="body1" fontWeight={500}>
            No contacts yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Save addresses above for quick access
          </Typography>
        </Box>
      ) : (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              Saved Contacts
            </Typography>
            <Chip label={addressBook.length} size="small" color="primary" />
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {addressBook.map((abe, i) => {
              const editMode = getEditMode(i);
              const editModeName = editMode?.name ?? "";
              const isInEditMode = editMode !== undefined;
              return (
                <AddressBookItemComponent
                  key={i}
                  {...props}
                  {...abe}
                  {...{
                    i,
                    impersonatedAddress,
                    setIsInEditMode,
                    saveCurrentName,
                    nameInputOnChange,
                    editModeName,
                    isInEditMode,
                    setImpersonatedAddress,
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};

const DEFAULT_HALF_N = 12;
const minimize = (s: string, halfN = DEFAULT_HALF_N): string =>
  s.length > halfN * 2 ? `${s.slice(0, halfN)}...${s.slice(-halfN)}` : s;

/** Individual AddressBook Rows */
interface AddressBookItemProps extends AddressBookItem, AddressBookItemActions {
  i: number;
  isInEditMode: boolean;
  editModeName: string;
  impersonatedAddress: string;
  setIsInEditMode: (i: number, newIsInEditMode: boolean, n?: string) => void;
  saveCurrentName: (i: number) => void;
  nameInputOnChange: (i: number, name: string) => void;
  removeFromAddressBook: (a: string) => void;
}

const AddressBookItemComponent = (props: AddressBookItemProps): JSX.Element => {
  const { i, name, editModeName, address, isInEditMode, nameInputOnChange, impersonatedAddress } =
    props;
  const addressIsValid = isValidAddress(address);
  const isCurrentAddress = address === impersonatedAddress;
  const isTestnet = address.startsWith("addr_test");

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: isCurrentAddress ? "primary.300" : "grey.200",
        borderRadius: 3,
        backgroundColor: isCurrentAddress ? "primary.50" : "white",
        transition: "all 0.15s ease",
        "&:hover": {
          borderColor: isCurrentAddress ? "primary.400" : "grey.300",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Avatar
          sx={{
            width: 40,
            height: 40,
            bgcolor: !addressIsValid
              ? "error.100"
              : isTestnet
              ? "warning.100"
              : isCurrentAddress
              ? "primary.100"
              : "success.100",
            color: !addressIsValid
              ? "error.main"
              : isTestnet
              ? "warning.main"
              : isCurrentAddress
              ? "primary.main"
              : "success.main",
          }}
        >
          {!addressIsValid ? (
            <ExclamIcon />
          ) : isTestnet ? (
            <TestnetIcon />
          ) : (
            <MainnetIcon />
          )}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {isInEditMode ? (
            <TextField
              fullWidth
              size="small"
              placeholder="Enter a label..."
              value={editModeName}
              onChange={(e) => nameInputOnChange(i, e.currentTarget.value)}
              autoFocus
              sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "white" } }}
            />
          ) : (
            <>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {name || "Unnamed"}
                </Typography>
                {isCurrentAddress && (
                  <Chip label="Active" size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />
                )}
                <Chip
                  label={isTestnet ? "Testnet" : "Mainnet"}
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: 10, borderColor: "grey.300" }}
                />
              </Box>
              <Tooltip title={address} placement="bottom-start">
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: "monospace",
                    color: "text.secondary",
                    cursor: "default",
                  }}
                >
                  {minimize(address, 10)}
                </Typography>
              </Tooltip>
            </>
          )}
        </Box>

        <AddressBookButtons {...props} />
      </Box>
    </Paper>
  );
};
/** Row Action Buttons */
const autoHideDuration = 1500;

const AddressBookButtons = ({
  i,
  address,
  name,
  isInEditMode,
  setIsInEditMode,
  saveCurrentName,
  removeFromAddressBook,
  setImpersonatedAddress,
  impersonatedAddress,
}: AddressBookItemProps): JSX.Element => {
  const [alertMessage, setAlertMessage] = useState<string | undefined>();
  const isCurrentAddress = address === impersonatedAddress;

  const openAlert = (m: string) => setAlertMessage(m);
  const closeAlert = (_event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === "clickaway") return;
    setAlertMessage(undefined);
  };

  const iconBtnSx = {
    width: 32,
    height: 32,
    bgcolor: "grey.100",
    "&:hover": { bgcolor: "grey.200" },
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {!isCurrentAddress && (
        <Tooltip title="Use this address" placement="top">
          <IconButton
            size="small"
            onClick={() => {
              setImpersonatedAddress(address);
              openAlert("Address activated");
            }}
            sx={{ ...iconBtnSx, bgcolor: "primary.100", color: "primary.main", "&:hover": { bgcolor: "primary.200" } }}
          >
            <PlayArrowIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}

      <Tooltip title="Copy" placement="top">
        <IconButton
          size="small"
          onClick={() => {
            navigator.clipboard.writeText(address);
            openAlert("Copied!");
          }}
          sx={iconBtnSx}
        >
          <CopyIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      {isInEditMode ? (
        <Tooltip title="Save" placement="top">
          <IconButton
            size="small"
            onClick={() => saveCurrentName(i)}
            sx={{ ...iconBtnSx, bgcolor: "success.100", color: "success.main", "&:hover": { bgcolor: "success.200" } }}
          >
            <SaveIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="Edit" placement="top">
          <IconButton size="small" onClick={() => setIsInEditMode(i, true, name)} sx={iconBtnSx}>
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}

      <Tooltip title="Delete" placement="top">
        <IconButton
          size="small"
          onClick={() => {
            if (confirm("Remove this contact?")) {
              removeFromAddressBook(address);
            }
          }}
          sx={{ ...iconBtnSx, "&:hover": { bgcolor: "error.100", color: "error.main" } }}
        >
          <DeleteIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Snackbar
        open={alertMessage !== undefined}
        autoHideDuration={autoHideDuration}
        onClose={closeAlert}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={closeAlert} severity="success" sx={{ width: "100%" }}>
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};
