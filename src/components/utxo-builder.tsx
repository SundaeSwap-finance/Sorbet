import AddIcon from "@mui/icons-material/AddRounded";
import RemoveIcon from "@mui/icons-material/DeleteForeverRounded";
import DataObjectIcon from "@mui/icons-material/DataObject";
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Switch,
  TextField,
  TextFieldProps,
  Tooltip,
  Typography,
  styled,
  useTheme,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { Quantity } from "../background";
import { useCustomResponse } from "../hooks/useCustomResponse";
import { isValidAddress } from "../utils/addresses";
import { assetsToEncodedBalance, computeBalanceFromAmounts } from "../utils/balance";
import {
  MultiAssetAmount,
  MultiAssetOut,
  UTxO,
  encodeUtxos,
  utxosToHexArray,
} from "../utils/utxo";
import { SorbetIconButton } from "./sorbet-icon-button";

export default function UTxOBuilder() {
  const { isCustomResponseEnabled, setIsCustomResponseEnabled, utxos, addU, setUi, removeUi } =
    useCustomResponse();
  const disabled = !isCustomResponseEnabled;
  const [showOutput, setShowOutput] = useState(false);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Enable Toggle */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: isCustomResponseEnabled ? "primary.50" : "grey.50",
          border: "1px solid",
          borderColor: isCustomResponseEnabled ? "primary.200" : "grey.200",
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              Custom UTxO Response
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Override wallet UTxOs with custom data
            </Typography>
          </Box>
          <Switch
            checked={Boolean(isCustomResponseEnabled)}
            onChange={(e) => setIsCustomResponseEnabled(e.target.checked)}
          />
        </Box>
      </Paper>

      {/* Add UTxO Button */}
      <Button
        variant="outlined"
        size="small"
        disabled={disabled}
        onClick={() => addU()}
        startIcon={<AddIcon />}
        sx={{ alignSelf: "flex-start" }}
      >
        Add UTxO
      </Button>

      {/* UTxO List */}
      {utxos.map((u, idx) => (
        <UTxOFieldList
          key={idx}
          index={idx}
          {...{ disabled, u, setU: (u2) => setUi(idx, u2), removeU: () => removeUi(idx) }}
        />
      ))}

      {/* Output Viewer */}
      {utxos.length > 0 && (
        <Box>
          <Button
            size="small"
            variant="text"
            disabled={disabled}
            onClick={() => setShowOutput(!showOutput)}
            startIcon={<DataObjectIcon />}
            sx={{ mb: 1 }}
          >
            {showOutput ? "Hide" : "Show"} Encoded Output
          </Button>
          <Collapse in={showOutput}>
            <UTxOViewer {...{ disabled, utxos }} />
          </Collapse>
        </Box>
      )}

      {/* Empty State */}
      {utxos.length === 0 && (
        <Box
          sx={{
            py: 3,
            textAlign: "center",
            color: "text.secondary",
          }}
        >
          <Typography variant="body2">No UTxOs added yet</Typography>
          <Typography variant="caption">
            Enable custom response and add UTxOs to override wallet data
          </Typography>
        </Box>
      )}
    </Box>
  );
}
const UTxOViewer = ({ utxos, disabled }: { utxos: UTxO[]; disabled: boolean }) => {
  const theme = useTheme();
  const [encodedUtxos, setEncodedUtxos] = useState<MultiAssetOut[]>([]);
  const [balance, setBalance] = useState<MultiAssetAmount<string> | null>(null);
  const [encodedBalance, setEncodedBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!utxos || utxos.length === 0) {
      setEncodedUtxos([]);
      setBalance(null);
      setEncodedBalance(null);
      return;
    }

    try {
      const validUtxos = utxos.filter((u) => u.amount && Array.isArray(u.amount));
      setEncodedUtxos(encodeUtxos(validUtxos));

      const computedBalance = computeBalanceFromAmounts(validUtxos as { amount: Quantity[] }[]);
      setBalance(computedBalance);
      setEncodedBalance(assetsToEncodedBalance(computedBalance as MultiAssetAmount<unknown>));
    } catch (e) {
      console.error("Error encoding UTxOs:", e);
    }
  }, [utxos]);

  if (!utxos || utxos.length === 0) {
    return null;
  }

  const CodeBlock = ({ label, content }: { label: string; content: string }) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
        {label}
      </Typography>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          bgcolor: "grey.900",
          color: "grey.100",
          borderRadius: 1,
          fontSize: 10,
          fontFamily: "monospace",
          overflow: "auto",
          maxHeight: 120,
        }}
      >
        {content}
      </Box>
    </Box>
  );

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "grey.50",
        color: disabled ? theme.palette.text.disabled : theme.palette.text.primary,
      }}
    >
      <CodeBlock label="Balance" content={balance ? JSON.stringify(balance, null, 2) : "N/A"} />
      <CodeBlock label="Balance (Hex)" content={encodedBalance ?? "N/A"} />
      <CodeBlock
        label="UTxOs (Hex)"
        content={encodedUtxos.length > 0 ? JSON.stringify(utxosToHexArray(encodedUtxos), null, 2) : "N/A"}
      />
    </Paper>
  );
};

interface UTxOFieldsProps {
  u: UTxO;
  setU: (u: UTxO) => void;
  removeU: () => void;
  disabled: boolean;
  index: number;
}
function UTxOFieldList({
  u,
  u: { amount },
  setU,
  removeU,
  disabled,
  index,
}: UTxOFieldsProps): React.JSX.Element {
  const fieldProps = { obj: u, setObj: setU, disabled };
  const addAmount = () =>
    setU({ ...u, amount: [...u.amount, { quantity: "0", unit: "lovelace" }] });
  const removeAmount = (idx: number) => {
    const amount = [...u.amount];
    amount.splice(idx, 1);
    setU({ ...u, amount });
  };
  const addressIsInvalid: boolean =
    u.address !== undefined && u.address !== "" && !isValidAddress(u.address);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        borderColor: disabled ? "grey.200" : "grey.300",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Chip
          label={`UTxO #${index + 1}`}
          size="small"
          color="primary"
          variant="outlined"
        />
        <Tooltip title="Remove UTxO">
          <IconButton
            size="small"
            disabled={disabled}
            onClick={() => removeU()}
            sx={{ color: "error.main" }}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* TX Hash & Output Index */}
      <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
        <TField fieldName="tx_hash" label="TX Hash" {...fieldProps} sx={{ flex: 2 }} />
        <TField fieldName="output_index" label="Index" {...fieldProps} sx={{ flex: 1 }} />
      </Box>

      {/* Address */}
      <TField
        fieldName="address"
        label="Address"
        {...fieldProps}
        errorText={addressIsInvalid ? "Invalid bech32 address" : undefined}
      />

      {/* Amounts */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: "block" }}>
          Amounts
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {amount?.map((a, idx2) => (
            <Box
              key={idx2}
              sx={{
                display: "flex",
                gap: 1,
                alignItems: "flex-start",
                p: 1.5,
                bgcolor: "grey.50",
                borderRadius: 1,
              }}
            >
              <UtxoField
                type="number"
                label="Quantity"
                value={a.quantity}
                disabled={disabled}
                onChange={(e) => {
                  const amt = [...amount];
                  amt[idx2].quantity = e.target.value;
                  setU({ ...u, amount: [...amt] });
                }}
                size="small"
                sx={{ flex: 1 }}
              />
              <UtxoField
                label="Unit"
                value={a.unit}
                disabled={disabled}
                onChange={(e) => {
                  const amt = [...amount];
                  amt[idx2].unit = e.target.value;
                  setU({ ...u, amount: [...amt] });
                }}
                size="small"
                sx={{ flex: 1 }}
              />
              <IconButton
                size="small"
                disabled={disabled || (amount.length < 2 && idx2 === 0)}
                onClick={() => removeAmount(idx2)}
                sx={{ mt: 0.5 }}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
        <Button
          size="small"
          variant="text"
          disabled={disabled}
          onClick={() => addAmount()}
          startIcon={<AddIcon />}
          sx={{ mt: 1 }}
        >
          Add Amount
        </Button>
      </Box>
    </Paper>
  );
}

const UtxoField = styled(TextField)({
  "& .MuiInputBase-input": {
    fontFamily: "monospace",
    fontSize: 13,
  },
}) as typeof TextField;

interface TFieldProps<O extends { [field: string]: any }>
  extends Partial<TextFieldProps<"outlined">> {
  fieldName: keyof O;
  obj: O;
  setObj: (u: O) => void;
  errorText?: string;
}
function TField<O extends { [field: string]: any }>({
  fieldName,
  obj,
  setObj,
  errorText,
  helperText,
  label,
  ...rest
}: TFieldProps<O>) {
  const defaultLabel = (fieldName as string)
    .split("_")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");

  return (
    <UtxoField
      fullWidth
      type={typeof obj[fieldName]}
      label={label ?? defaultLabel}
      value={obj[fieldName]}
      onChange={(e) => setObj({ ...obj, [fieldName]: e.target.value })}
      size="small"
      error={errorText !== undefined}
      helperText={errorText}
      {...rest}
    />
  );
}
