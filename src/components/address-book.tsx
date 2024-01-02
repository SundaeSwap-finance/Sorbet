import React, { useState } from "react"
import { Box, Tooltip, IconButton, TextField, ButtonGroup } from "@mui/material"
import RemoveIcon from "@mui/icons-material/HighlightOff"
import CopyIcon from "@mui/icons-material/FileCopy"
import EditIcon from "@mui/icons-material/Edit"
import SaveIcon from "@mui/icons-material/Save"
import ExclamIcon from "@mui/icons-material/PriorityHighRounded"
import MainnetIcon from "@mui/icons-material/Hub"
import TestnetIcon from "@mui/icons-material/BugReport"
import { isValidAddress } from "../utils/addresses"

export type AddressBookEntry = { name?: string, address: string }
export type AddressBook = AddressBookEntry[]

interface AddressBookProps {
  addressBook: AddressBook,
  removeFromAddressBook: (a: string) => void,
  addOrUpdateAddressBookEntry: (abe: AddressBookEntry) => void
}

interface EditMode { i: number, name: string }
export const AddressBookComponent = (props: AddressBookProps): JSX.Element => {
  const { addressBook, addOrUpdateAddressBookEntry } = props
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

  return (
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
            {...{ i, setIsInEditMode, saveCurrentName, nameInputOnChange, editModeName, isInEditMode }}
          />)
      }
      )}
    </Box>
  )
};

const DEFAULT_HALF_N = 16
const minimize = (s: string, halfN = DEFAULT_HALF_N): JSX.Element => (
  s.length > (halfN * 2) ? <><span>{s.slice(0, halfN)}</span>&hellip;<span>{s.slice(-halfN)}</span></> : <>s</>
)
interface AddressBookEntryProps extends AddressBookEntry {
  i: number,
  isInEditMode: boolean, editModeName: string,
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
          <div style={{ fontSize: 14, width: '100%' }}>{
            (name && name != "") ?
              <>
                <b>{name.slice(0, Math.min(name.length - 1, DEFAULT_HALF_N))}: </b>
                {minimize(address, DEFAULT_HALF_N - Math.ceil(Math.min(name.length - 1, DEFAULT_HALF_N) / 2) - 1)}
              </>
              : minimize(address)}</div>
        </Tooltip>
      }
      <AddressBookButtons {...props} />
    </Box>
  )
}

interface AddressBookButtonsProps extends AddressBookEntryProps { }
const AddressBookButtons = ({
  i, address, name,
  isInEditMode, setIsInEditMode,
  saveCurrentName, removeFromAddressBook
}: AddressBookButtonsProps): JSX.Element => {
  return (
    <ButtonGroup>
      <IconButton
        aria-label="Copy address to clipboard"
        size="small"
        onClick={() => navigator.clipboard.writeText(address)}
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
    </ButtonGroup>
  )
};