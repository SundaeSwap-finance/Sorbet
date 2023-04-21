import React from "react";
import { InputLabel, MenuItem, Select } from "@mui/material";

export const WalletSelect = ({
  wallet,
  onChange,
  label,
}: {
  label?: string;
  wallet: string;
  onChange: (newValue: string) => void;
}) => {
  return (
    <div style={{ marginBottom: 10, width: "100%" }}>
      <InputLabel id="wallet">{label ?? "Wallet"}</InputLabel>
      <Select
        fullWidth
        labelId="wallet"
        label={wallet}
        value={wallet}
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value="none">None</MenuItem>
        <MenuItem value="begin">Begin</MenuItem>
        <MenuItem value="eternl">Eternl</MenuItem>
        <MenuItem value="nami">Nami</MenuItem>
        <MenuItem value="typhoncip30">Typhon</MenuItem>
        <MenuItem value="yoroi">Yoroi</MenuItem>
      </Select>
    </div>
  );
};
