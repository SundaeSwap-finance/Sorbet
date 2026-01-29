import BookmarkIcon from "@mui/icons-material/Bookmark";
import { Autocomplete, Box, Popper, TextField, Typography, createFilterOptions } from "@mui/material";
import React from "react";
import { AddressBook, AddressBookItem } from "../types";

interface AddressAutoCompleteProps {
  addressBook: AddressBook;
  impersonatedAddress: string;
  impersonatedAddressIsValid: boolean;
  updateImpersonatedWallet: (a: string) => void;
  finalizeImpersonatedWallet: (a: string) => void;
  addOrUpdateAddressBookItem: (item: AddressBookItem) => void;
}

export const AddressAutoComplete = ({
  addressBook,
  impersonatedAddress,
  impersonatedAddressIsValid,
  updateImpersonatedWallet,
  finalizeImpersonatedWallet,
}: AddressAutoCompleteProps) => {
  const impersonatedAddressBookItem = addressBook.find(
    (abi) => abi.address === impersonatedAddress
  );

  const showAddressError = !impersonatedAddressIsValid && impersonatedAddress !== "";
  
  return (
    <>
      <Autocomplete
        fullWidth
        disablePortal
        freeSolo
        disableClearable
        id="impersonated-address"
        value={impersonatedAddress}
        options={addressBook}
        isOptionEqualToValue={(option, value) => option.address === value.address}
        getOptionLabel={(addressBookItem) =>
          !addressBookItem
            ? ""
            : typeof addressBookItem === "string"
            ? addressBookItem
            : addressBookItem.address
        }
        renderOption={(props, abi) => (
          <Box
            component="li"
            {...props}
            key={abi.address}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start !important",
              py: 1,
              px: 1.5,
            }}
          >
            {abi.name && (
              <Typography variant="body2" fontWeight={500}>
                {abi.name}
              </Typography>
            )}
            <Typography
              variant="caption"
              sx={{ fontFamily: "monospace", color: "text.secondary" }}
            >
              {abi.address.slice(0, 24)}...{abi.address.slice(-8)}
            </Typography>
          </Box>
        )}
        filterOptions={createFilterOptions({
          matchFrom: "any",
          stringify: (option) => option.name + option.address,
        })}
        onChange={(_e, v) => {
          if (v) {
            const val = typeof v === "string" ? v : v.address;
            updateImpersonatedWallet(val);
            finalizeImpersonatedWallet(val);
          }
        }}
        PopperComponent={(props) => <Popper {...props} placement="bottom" />}
        renderInput={(params) => (
          <TextField
            {...params}
            fullWidth
            label="Impersonated Address"
            variant="outlined"
            type="text"
            onChange={(e) => {
              updateImpersonatedWallet(e.target.value);
            }}
            onBlur={(e) => {
              finalizeImpersonatedWallet(e.target.value);
            }}
            error={showAddressError}
            helperText={showAddressError ? "not a valid bech32 address" : ""}
          />
        )}
      />
      {impersonatedAddressBookItem?.name && (
        <Typography
          variant="caption"
          sx={{
            mt: 0.5,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            color: "primary.main",
          }}
        >
          <BookmarkIcon sx={{ fontSize: 14 }} />
          {impersonatedAddressBookItem.name}
        </Typography>
      )}
    </>
  );
};
