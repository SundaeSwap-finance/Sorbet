import React, { ReactElement } from "react";
import StarIcon from "@mui/icons-material/Star";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import { Popper, Autocomplete, IconButton, TextField, createFilterOptions } from "@mui/material"
import { AddressBook } from './address-book'

export const autocompleteThemeOverrides = {
    components: {
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    "&&&.MuiAutocomplete-inputRoot": {
                        paddingRight: "62px !important"
                    }
                }
            }
        }
    }
}
interface AddressAutoCompleteProps {
    addressBook: AddressBook,
    impersonatedAddress: string, impersonatedAddressIsValid: boolean,
    addToAddressBook: (a: string) => void, removeFromAddressBook: (a: string) => void,
    updateImpersonatedWallet: (a: string) => void, finalizeImpersonatedWallet: (a: string) => void
}
export const AddressAutoComplete = ({
    addressBook, impersonatedAddress, impersonatedAddressIsValid,
    addToAddressBook, removeFromAddressBook,
    updateImpersonatedWallet, finalizeImpersonatedWallet,
}: AddressAutoCompleteProps) => {
    const impersonatedAddressBookEntry = addressBook.find(abe => abe.address === impersonatedAddress)
    const impersonatedAddressIsInAddressBook = (impersonatedAddressBookEntry !== undefined)

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
                options={addressBook}
                isOptionEqualToValue={(option, value) => option.address === value.address}
                getOptionLabel={(addressBookEntry) => !addressBookEntry ? "" : typeof addressBookEntry === 'string' ? addressBookEntry : addressBookEntry.address}
                renderOption={(props, addressBookEntry) => (
                    <li key={addressBookEntry.address} {...props} style={{ whiteSpace: 'nowrap' }}>{addressBookEntry.name && <b>{addressBookEntry.name}:&nbsp;</b>}{addressBookEntry.address}</li>
                )}
                filterOptions={createFilterOptions({
                    matchFrom: 'any',
                    stringify: (option) => option.name + option.address,
                })}
                onChange={(_e, v) => {
                    if (v) {
                        const val = typeof v === 'string' ? v : v.address
                        updateImpersonatedWallet(val)
                        finalizeImpersonatedWallet(val)
                    }
                }}
                PopperComponent={(props) => <Popper {...props} placement='bottom' />}
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
                                    key={1}
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
                        onChange={(e) => {
                            updateImpersonatedWallet(e.target.value)
                        }}
                        onBlur={(e) => {
                            finalizeImpersonatedWallet(e.target.value)
                        }}
                        error={showAddressError}
                        helperText={showAddressError ? "not a valid bech32 address" : ""}
                    />
                )}
            />
            {impersonatedAddressBookEntry && <b style={{whiteSpace: "nowrap", overflow: "clip"}}>{impersonatedAddressBookEntry.name ?? "(unamed Address Book entry)"}</b>}
        </>
    )
}