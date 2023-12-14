import React, { ReactElement } from "react";
import { Box, Popper, Tooltip, Autocomplete, IconButton, TextField } from "@mui/material"
import RemoveIcon from "@mui/icons-material/HighlightOff";
import StarIcon from "@mui/icons-material/Star";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import ExclamationIcon from "@mui/icons-material/PriorityHighRounded";
import MainnetIcon from "@mui/icons-material/Hub";
import TestnetIcon from "@mui/icons-material/BugReport";
import { bech32 } from "bech32";

export const isValidAddress = (s: string) => {
  try {
    bech32.decode(s, s.length)
    return true
  } catch (e) {
    return false
  }
}

interface AddressBookProps { addressBook: string[], removeFromAddressBook: (a: string) => void }
export const AddressBook = ({ addressBook, removeFromAddressBook }: AddressBookProps) => {
  const minimize = (s: string, halfN = 18) => s.length > (halfN * 2) ? 
    <><span>{s.slice(0, halfN)}</span>&hellip;<span>{s.slice(-halfN)}</span></> : s

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "left",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {addressBook.map((a, i) => (
        <Box
          sx={{
            display: "flex",
            alignItems: "left",
            flexDirection: "row",
            justifyContent: "space-between"
          }}
          key={i}
        >
          {!isValidAddress(a) ? <ExclamationIcon /> : a.startsWith('addr_test') ? <TestnetIcon /> : <MainnetIcon />}
          <Tooltip title={a}>
            <div>{minimize(a)}</div>
          </Tooltip>
          <Tooltip title="remove from address book">
            <IconButton
              aria-label="remove from address book"
              size="small"
              color={"primary"}
              onClick={() => removeFromAddressBook(a)}
            >
              <RemoveIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ))}
    </Box>
  )
}

export const autocompleteThemeOverrides = {
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&&&": {
            paddingRight: "62px"
          }
        }
      }
    }
  }
}
interface AddressAutoCompleteProps extends AddressBookProps {
  impersonatedAddress: string, impersonatedAddressIsValid:boolean, 
  updateImpersonatedWallet: (a: string) => void, finalizeImpersonatedWallet: (a: string) => void
  addToAddressBook: (a: string) => void
}
export const AddressAutoComplete = ({
  addressBook, impersonatedAddress, impersonatedAddressIsValid, 
  updateImpersonatedWallet, finalizeImpersonatedWallet,
  removeFromAddressBook, addToAddressBook
}: AddressAutoCompleteProps) => {
  const impersonatedAddressIsInAddressBook = (addressBook.indexOf(impersonatedAddress) > -1)

  const addIconToEndAdornment = (endAdornment: ReactElement, icon: ReactElement) => {
    const children = React.Children.toArray(endAdornment.props.children);
    children.push(icon);
    return React.cloneElement(endAdornment, {}, children);
  }
  const showAddressError = !impersonatedAddressIsValid && impersonatedAddress !== ""
  return (
    <>
      <Autocomplete
        fullWidth
        disablePortal
        freeSolo
        id="impersonated-address"
        value={impersonatedAddress}
        options={addressBook.map((label, id) => ({ label, id }))}
        PopperComponent={(props) => <Popper {...props} placement='bottom' />}
        onChange={(_e, v) => {
          if (v) {
            const val = typeof v === 'string' ? v : v.label
            updateImpersonatedWallet(val)
            finalizeImpersonatedWallet(val)
          }
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            fullWidth
            label="Impersonated Address"
            variant="outlined"
            InputProps={{
              ...params.InputProps,
              endAdornment: addIconToEndAdornment(params.InputProps.endAdornment as ReactElement,
                <IconButton
                  aria-label={impersonatedAddressIsInAddressBook ? "remove from address book" : "add to address book"}
                  size="small"
                  color={"primary"}
                  onClick={() => {
                    if (impersonatedAddressIsValid) {
                      impersonatedAddressIsInAddressBook ? removeFromAddressBook(impersonatedAddress) : addToAddressBook(impersonatedAddress)
                    }
                  }}
                >
                  {impersonatedAddressIsInAddressBook ? <StarIcon /> : <StarOutlineIcon />}
                </IconButton>
              )
            }}
            type="text"
            onChange={(e) => updateImpersonatedWallet(e.target.value)}
            onBlur={(e) => finalizeImpersonatedWallet(e.target.value)}
            error={showAddressError}
            helperText={showAddressError ? "not a valid bech32 address" : ""}
          />
        )}
      />
    </>
  )
}