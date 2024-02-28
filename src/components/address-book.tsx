import React, { useState } from "react"
import { Box, Tooltip, IconButton, TextField, ButtonGroup, Button, Grid, Snackbar } from "@mui/material"
import RemoveIcon from "@mui/icons-material/HighlightOff"
import SetAddressIcon from "@mui/icons-material/RadioButtonUnchecked"
import CurrentAddressIcon from "@mui/icons-material/RadioButtonChecked"
import AddAddressIcon from "@mui/icons-material/Add"
import CopyIcon from "@mui/icons-material/FileCopy"
import EditIcon from "@mui/icons-material/Edit"
import SaveIcon from "@mui/icons-material/Save"
import ExclamIcon from "@mui/icons-material/PriorityHighRounded"
import MainnetIcon from "@mui/icons-material/Hub"
import TestnetIcon from "@mui/icons-material/BugReport"
import { isValidAddress } from "../utils/addresses"

export type AddressBookEntry = { name?: string, address: string }
export type AddressBook = AddressBookEntry[]

export const parseAddressBookFromStorage = (result: { addressBook?: AddressBook }) : AddressBook | undefined => {
  if (result.addressBook && Array.isArray(result.addressBook)) {
      return result.addressBook.map(e => (
        typeof e ===  'string' ? {address: e} as AddressBookEntry : e
      ))
  }
  return undefined
}

interface AddressBookEntryActions {
  setImpersonatedAddress: (a: string) => void
}
interface AddressBookProps extends AddressBookEntryActions {
  addressBook: AddressBook,
  impersonatedAddress: string,
  removeFromAddressBook: (a: string) => void,
  addOrUpdateAddressBookEntry: (abe: AddressBookEntry) => void
}

interface EditMode { i: number, name: string }

/** MAIN AddressBook Component */
export const AddressBookComponent = (props: AddressBookProps): JSX.Element => {
  const { addressBook, impersonatedAddress, setImpersonatedAddress,
    addOrUpdateAddressBookEntry, } = props
  const [editModes, setEditModes] = useState<EditMode[]>([])

  const getEditMode = (i: number): EditMode | undefined => editModes.find(em => em.i === i)
  const enableEditMode = (i: number, initialName?: string): void => {
    setEditModes([...editModes, { i, name: initialName ?? "" }])
  }
  const disableEditMode = (i: number): void => {
    setEditModes([...editModes].filter(em => em.i !== i))
  }
  const setIsInEditMode = (i: number, newIsInEditMode: boolean, initialName?: string): void => {
    if (!newIsInEditMode) {
      disableEditMode(i)
    } else {
      enableEditMode(i, initialName)
    }
  }
  const saveCurrentName = (i: number): void => {
    const editMode = getEditMode(i)
    if (editMode) {
      const abe = addressBook[i]
      addOrUpdateAddressBookEntry({ ...abe, name: editMode.name })
      setIsInEditMode(i, false)
    }
  }
  const nameInputOnChange = (i: number, name: string): void => {
    const newEditModes = [...editModes].map(em =>
      em.i === i ? ({ i, name }) : em
    )
    setEditModes(newEditModes)
  }
  const promptForNewAddressBookEntry = () => {
    let addr = prompt("Please enter an address to add to the Address Book")
    if (addr) {
      if (!isValidAddress(addr)) {
        confirm("not a valid bech32 address: " + addr + "\n\nPlease verify the address and try again.")
      } else {
        addOrUpdateAddressBookEntry({ address: addr })
      }
    }
  }

  return (
    <>
      <ButtonGroup>
        <IconButton onClick={() => promptForNewAddressBookEntry()}>
          <Tooltip title="Add a New Address" placement="top">
            <AddAddressIcon />
          </Tooltip>
        </IconButton>
      </ButtonGroup>
      <Box
        sx={{
          display: "flex",
          alignItems: "left",
          flexDirection: "column",
          justifyContent: "space-between",
          border: 1,
          borderColor: 'grey.300',
          padding: 1,
          marginBottom: 2,
        }}
      >
        {addressBook.map((abe, i) => {
          const editMode = getEditMode(i)
          const editModeName = editMode?.name ?? ""
          const isInEditMode = editMode !== undefined
          return (
            <AddressBookEntryComponent key={i} {...props} {...abe}
              {...{
                i, impersonatedAddress,
                setIsInEditMode, saveCurrentName, nameInputOnChange, editModeName, isInEditMode, setImpersonatedAddress
              }}
            />)
        }
        )}
      </Box>
    </>
  )
};

const DEFAULT_HALF_N = 14
const minimize = (s: string, halfN = DEFAULT_HALF_N): JSX.Element => (
  s.length > (halfN * 2) ? <><span>{s.slice(0, halfN)}</span>&hellip;<span>{s.slice(-halfN)}</span></> : <>s</>
)
/** Individual AddressBook Rows */
interface AddressBookEntryProps extends AddressBookEntry, AddressBookEntryActions {
  i: number,
  isInEditMode: boolean, editModeName: string,
  impersonatedAddress: string,
  setIsInEditMode: (i: number, newIsInEditMode: boolean, n?: string) => void,
  saveCurrentName: (i: number) => void,
  nameInputOnChange: (i: number, name: string) => void,
  removeFromAddressBook: (a: string) => void,
}
const AddressBookEntryComponent = (props: AddressBookEntryProps): JSX.Element => {
  const { i, name, editModeName, address, isInEditMode, nameInputOnChange } = props
  const addressIsValid = isValidAddress(address)

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexDirection: "row",
      }}
    >
      <Tooltip title={!addressIsValid ? "invalid address" : address.startsWith('addr_test') ? "Testnet" : "Mainnet"}
        style={{ marginRight: 6 }}>
        {!addressIsValid ? <ExclamIcon /> : address.startsWith('addr_test') ? <TestnetIcon /> : <MainnetIcon />}
      </Tooltip>
      {isInEditMode ?
        <TextField
          fullWidth
          inputProps={{ style: { padding: 5 } }}
          InputLabelProps={{ shrink: true }}
          label="Name this address"
          variant="outlined"
          value={editModeName}
          onChange={(e) => nameInputOnChange(i, e.currentTarget.value)}
        />
        : <Tooltip title={address}>
          <Box
            sx={{
              display: "flex",
              alignItems: "left",
              flexDirection: "column",
              overflow: "clip",
              whiteSpace: "nowrap",
              fontSize: 14,
              width: "100%",
            }}>
            {(name && name != "") && <div><b>{name}: </b></div>}
            <div>{minimize(address)}</div>
          </Box>
        </Tooltip>
      }
      <AddressBookButtons {...props} />
    </Box>
  )
}
/** Row Action Buttons */
const autoHideDuration = 900
interface AddressBookButtonsProps extends AddressBookEntryProps { }
const AddressBookButtons = ({
  i, address, name,
  isInEditMode, setIsInEditMode,
  saveCurrentName, removeFromAddressBook,
  setImpersonatedAddress, impersonatedAddress,
}: AddressBookButtonsProps): JSX.Element => {
  const [alertMessage, setAlertMessage] = useState<string | undefined>();
  const openAlert = (m: string) => setAlertMessage(m)
  const closeAlert = (event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setAlertMessage(undefined)
  }
  return (
    <ButtonGroup>
      {address === impersonatedAddress ?
        <Tooltip title="* Current Address" placement="left">
          <CurrentAddressIcon style={{ margin: 5 }} />
        </Tooltip>
        : <IconButton
          aria-label="Set as Impersonated Wallet Address"
          size="small"
          onClick={() => {
            setImpersonatedAddress(address)
            openAlert("Impersonated Address Changed")
          }}
        >
          <Tooltip title={address === impersonatedAddress ? "* Current Address" : "Set impersonated address"} placement="left">
            <SetAddressIcon />
          </Tooltip>
        </IconButton>
      }
      <IconButton
        aria-label="Copy address to clipboard"
        size="small"
        onClick={() => {
          navigator.clipboard.writeText(address)
          openAlert("Address copied")
        }}
      >
        <Tooltip title="Copy" placement="left">
          <CopyIcon />
        </Tooltip>
      </IconButton>
      {isInEditMode ?
        <IconButton
          aria-label="Save name for address"
          size="small"
          onClick={() => saveCurrentName(i)}
        >
          <Tooltip title="Save" placement="top">
            <SaveIcon />
          </Tooltip>
        </IconButton>
        : <IconButton
          aria-label="Edit name for address"
          size="small"
          onClick={() => setIsInEditMode(i, true, name)}
        >
          <Tooltip title="Edit" placement="top">
            <EditIcon />
          </Tooltip>
        </IconButton>}
      <IconButton
        aria-label="Remove from Address Book"
        size="small"
        color={"primary"}
        onClick={() => {
          if (confirm("Remove Addresss from your Address Book?"))
            removeFromAddressBook(address)
        }}
      >
        <Tooltip title="Remove" placement="top">
          <RemoveIcon />
        </Tooltip>
      </IconButton>
      <Snackbar
        open={alertMessage !== undefined}
        autoHideDuration={autoHideDuration}
        onClose={closeAlert}
        message={alertMessage}
      />
    </ButtonGroup>
  )
};