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
import EditIcon from "@mui/icons-material/Edit";
import CopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import ExclamIcon from "@mui/icons-material/ErrorOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import SaveIcon from "@mui/icons-material/Check";
import { isValidAddress } from "../utils/addresses";
import { AddressBook, AddressBookItem } from "../types";
import { addAddress, removeAddress, upsertAddressBookItem } from "../modules/addressBookStorage";

interface AddressBookItemActions {
  setImpersonatedAddress: (a: string) => void;
}
interface AddressBookProps extends AddressBookItemActions {
  addressBook: AddressBook;
  impersonatedAddress: string;
}

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** MAIN AddressBook Component */
export const AddressBookComponent = (props: AddressBookProps): JSX.Element => {
  const { addressBook, impersonatedAddress, setImpersonatedAddress } = props;
  /** Name drafts of rows in edit mode, keyed by address. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newAddress, setNewAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);

  const setIsInEditMode = (address: string, editing: boolean, initialName?: string): void => {
    setDrafts((current) => {
      const { [address]: _removed, ...rest } = current;
      return editing ? { ...rest, [address]: initialName ?? "" } : rest;
    });
  };
  const nameInputOnChange = (address: string, name: string): void =>
    setDrafts((current) => ({ ...current, [address]: name }));

  const saveCurrentName = async (address: string): Promise<void> => {
    const name = drafts[address];
    if (name === undefined) return;
    try {
      await upsertAddressBookItem({ address, name });
      setIsInEditMode(address, false);
    } catch (e) {
      setAddressError(`Could not save contact: ${errorMessage(e)}`);
    }
  };
  const removeFromAddressBook = async (address: string): Promise<void> => {
    try {
      await removeAddress(address);
      setIsInEditMode(address, false);
    } catch (e) {
      setAddressError(`Could not remove contact: ${errorMessage(e)}`);
    }
  };

  const handleAddAddress = async () => {
    const address = newAddress.trim();
    if (!address) return;

    if (!isValidAddress(address)) {
      setAddressError("Invalid bech32 address format");
      return;
    }

    try {
      await addAddress(address);
      setNewAddress("");
      setAddressError(null);
    } catch (e) {
      setAddressError(`Could not save contact: ${errorMessage(e)}`);
    }
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
            {addressBook.map((abe) => {
              const draft = drafts[abe.address];
              return (
                <AddressBookItemComponent
                  key={abe.address}
                  {...abe}
                  {...{
                    impersonatedAddress,
                    setIsInEditMode,
                    saveCurrentName,
                    removeFromAddressBook,
                    nameInputOnChange,
                    editModeName: draft ?? "",
                    isInEditMode: draft !== undefined,
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
  isInEditMode: boolean;
  editModeName: string;
  impersonatedAddress: string;
  setIsInEditMode: (address: string, newIsInEditMode: boolean, n?: string) => void;
  saveCurrentName: (address: string) => void;
  nameInputOnChange: (address: string, name: string) => void;
  removeFromAddressBook: (a: string) => void;
}

const AddressBookItemComponent = (props: AddressBookItemProps): JSX.Element => {
  const { name, editModeName, address, isInEditMode, nameInputOnChange, impersonatedAddress } =
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
        borderColor: isCurrentAddress ? "primary.200" : "grey.200",
        borderRadius: 3,
        backgroundColor: isCurrentAddress ? "primary.50" : "white",
        transition: "all 0.15s ease",
        "&:hover": {
          borderColor: isCurrentAddress ? "primary.main" : "grey.300",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Avatar
          sx={{
            width: 36,
            height: 36,
            fontSize: 14,
            fontWeight: 600,
            bgcolor: !addressIsValid
              ? "error.100"
              : isCurrentAddress
              ? "primary.100"
              : "grey.200",
            color: !addressIsValid
              ? "error.main"
              : isCurrentAddress
              ? "primary.main"
              : "grey.600",
          }}
        >
          {!addressIsValid ? (
            <ExclamIcon sx={{ fontSize: 18 }} />
          ) : name ? (
            name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
          ) : (
            address.slice(5, 7).toUpperCase()
          )}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {isInEditMode ? (
            <TextField
              fullWidth
              size="small"
              placeholder="Enter a label..."
              value={editModeName}
              onChange={(e) => nameInputOnChange(address, e.currentTarget.value)}
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
  address,
  name,
  isInEditMode,
  setIsInEditMode,
  saveCurrentName,
  removeFromAddressBook,
  setImpersonatedAddress,
  impersonatedAddress,
}: AddressBookItemProps): JSX.Element => {
  const [feedback, setFeedback] = useState<
    { message: string; severity: "success" | "error" } | undefined
  >();
  const isCurrentAddress = address === impersonatedAddress;

  const openAlert = (message: string, severity: "success" | "error" = "success") =>
    setFeedback({ message, severity });
  const closeAlert = (_event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === "clickaway") return;
    setFeedback(undefined);
  };

  const iconBtnSx = {
    width: 32,
    height: 32,
    bgcolor: "grey.100",
    "&:hover": { bgcolor: "grey.200" },
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {isCurrentAddress ? (
        <Tooltip title="Disconnect" placement="top">
          <IconButton
            size="small"
            onClick={() => {
              setImpersonatedAddress("");
              openAlert("Address disconnected");
            }}
            sx={{ ...iconBtnSx, bgcolor: "error.100", color: "error.main", "&:hover": { bgcolor: "error.200" } }}
          >
            <StopIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      ) : (
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
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(address);
              openAlert("Copied!");
            } catch (e) {
              openAlert(`Copy failed: ${errorMessage(e)}`, "error");
            }
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
            onClick={() => saveCurrentName(address)}
            sx={{ ...iconBtnSx, bgcolor: "success.100", color: "success.main", "&:hover": { bgcolor: "success.200" } }}
          >
            <SaveIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="Edit" placement="top">
          <IconButton size="small" onClick={() => setIsInEditMode(address, true, name)} sx={iconBtnSx}>
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
        open={feedback !== undefined}
        autoHideDuration={autoHideDuration}
        onClose={closeAlert}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={closeAlert} severity={feedback?.severity ?? "success"} sx={{ width: "100%" }}>
          {feedback?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
