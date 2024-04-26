import RemoveIcon from "@mui/icons-material/DeleteForeverRounded";
import { Box, Button, InputLabel, Switch, TextField, TextFieldProps, Typography, styled, useTheme } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useCustomResponse } from "../hooks/useCustomResponse";
import { isValidAddress } from "../utils/addresses";
import { MultiAssetOut, UTxO, encodeUtxos, utxosToHexArray } from "../utils/utxo";
import { SorbetIconButton } from "./sorbet-icon-button";

export default function UTxOBuilder() {
  const { isCustomResponseEnabled, setIsCustomResponseEnabled, utxos, addU, setUi, removeUi, } = useCustomResponse()
  const disabled = !isCustomResponseEnabled
  return (
    <>
      <Typography component='h2' variant='h6'>UTxO Builder</Typography>
      <Box display='flex' >
        <InputLabel id="is-override">Enable custom response</InputLabel>
        <Switch checked={Boolean(isCustomResponseEnabled)} onChange={(e) => setIsCustomResponseEnabled(e.target.checked)} />
        <Button disabled={disabled} onClick={() => addU()}>+ Add UTXO</Button>
      </Box>
      {utxos.map((u, idx) => (
        <UTxOFieldList key={idx} {...{ disabled, u, setU: (u2) => setUi(idx, u2), removeU: () => removeUi(idx) }} />
      ))}
      <UTxOViwer {...{ disabled, utxos }} />
    </>
  )
}
const UTxOViwer = ({ utxos, disabled }: { utxos: UTxO[], disabled: boolean }) => {
  const theme = useTheme();
  const [encodedUtxos, setEncodedUtxos] = useState<MultiAssetOut[]>([])
  useEffect(() => {
    if (utxos && utxos.length > 0)
      setEncodedUtxos(encodeUtxos(utxos))
  }, [utxos])
  return (
    <Box
      sx={{
        fontSize: 10,
        overflow: 'scroll',
        border: '1px solid #eee',
        p: 1,
        color: disabled ? theme.palette.text.disabled : theme.palette.text.primary
      }}
    >
      <div>
        <b>UTxOs Hex Encoded:</b>
        <pre>
          {encodedUtxos && JSON.stringify(utxosToHexArray(encodedUtxos), null, 2)}
        </pre>
      </div>
      <div>
        <b>UTxOs with Assets: </b>
        <pre>
          {encodedUtxos && JSON.stringify(encodedUtxos, null, 2)}
        </pre>
      </div>
      <div>
        <b>UTxOs Array: </b>
        <pre>
          {JSON.stringify(utxos, null, 2)}
        </pre>
      </div>
    </Box>
  )
}

interface UTxOFieldsProps {
  u: UTxO, setU: (u: UTxO) => void, removeU: () => void,
  disabled: boolean,
}
function UTxOFieldList({ u, u: { amount }, setU, removeU, disabled }: UTxOFieldsProps): React.JSX.Element {
  const fieldProps = { obj: u, setObj: setU, disabled }
  const addAmount = () => setU({ ...u, amount: [...u.amount, { quantity: '0', unit: 'lovelace' }] })
  const removeAmount = (idx: number) => {
    const amount = [...u.amount]
    amount.splice(idx, 1)
    setU({ ...u, amount })
  }
  const addressIsInvalid: boolean = u.address !== undefined && u.address !== '' && !isValidAddress(u.address)
  return (
    <Box sx={{
      display: "flex",
      flexDirection: 'row',
      border: `1px solid ${disabled ? '#ccc' : '#888'}`,
      p: 2, m: 1,
      borderRadius: 1,
    }}>
      <Box
        component="form"
        noValidate
        autoComplete="off">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row'
          }}>
          <TField fieldName='tx_hash' {...fieldProps} sx={{ width: '60%' }} />
          <TField fieldName='output_index' {...fieldProps} sx={{ width: '30%' }} />
          <SorbetIconButton tooltipTitle="Remove UTxO entry"
            disabled={disabled}
            onClick={() => removeU()}
          >
            <RemoveIcon sx={{ fontSize: 24 }} />
          </SorbetIconButton>
        </Box>
        <TField fieldName='address' {...fieldProps}
          errorText={addressIsInvalid ? "not a valid bech32 address" : undefined}
          helperText={addressIsInvalid ? undefined : " "}
        />

        <Box sx={{
          display: "flex",
          flexDirection: 'column',
          p: 0, ml: 1, mr: 1,
          borderRadius: 1,
        }}>
          {amount?.map((a, idx2) => (
            <Box
              key={idx2}
              sx={{
                display: "flex",
                flexDirection: 'column',
                border: `1px solid ${disabled ? '#ccc' : '#bbb'}`,
                p: 1, m: 1,
                borderRadius: 1,
              }}>
              <UtxoField
                fullWidth
                type='number'
                label={'Quantity'}
                value={a.quantity}
                disabled={disabled}
                onChange={(e) => {
                  const amt = [...amount]
                  amt[idx2].quantity = e.target.value
                  setU({ ...u, amount: [...amt] })
                }}
                size='small'
              />
              <Box
                sx={{
                  display: "flex",
                  flexDirection: 'row',
                }}>
                <UtxoField
                  fullWidth
                  label={'Unit'}
                  value={a.unit}
                  disabled={disabled}
                  onChange={(e) => {
                    const amt = [...amount]
                    amt[idx2].unit = e.target.value
                    setU({ ...u, amount: [...amt] })
                  }}
                  size='small'
                />
                <SorbetIconButton tooltipTitle="Remove account entry"
                  size='small'
                  disabled={disabled || (amount.length < 2 && idx2 === 0)}
                  onClick={() => removeAmount(idx2)}
                >
                  <RemoveIcon />
                </SorbetIconButton>
              </Box>
            </Box>
          ))}
          <Button size="small" disabled={disabled} onClick={() => addAmount()}>+ Add Amount</Button>
        </Box>
      </Box>
    </Box>
  )
}

const UtxoField = styled(TextField)({
  margin: 6,
}) as typeof TextField;
interface TFieldProps<O extends { [field: string]: any }> extends Partial<TextFieldProps<'outlined'>> {
  fieldName: keyof O,
  obj: O, setObj: (u: O) => void,
  errorText?: string
}
function TField<O extends { [field: string]: any }>({ fieldName, obj, setObj, errorText, helperText, ...rest }: TFieldProps<O>) {
  return (
    <>
      <UtxoField
        fullWidth
        type={typeof obj[fieldName]}
        label={(fieldName as string)[0].toUpperCase() + (fieldName as string).slice(1)}
        value={obj[fieldName]}
        onChange={(e) => setObj({ ...obj, [fieldName]: e.target.value })}
        size='small'
        error={errorText !== undefined}
        {...rest}
        helperText={helperText ?? errorText}
      />
    </>
  )
}