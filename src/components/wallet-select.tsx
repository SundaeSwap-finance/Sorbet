import React from "react";
import { MenuItem, TextField } from "@mui/material";

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
      <TextField
        select
        fullWidth
        label={label ?? "Wallet"}
        value={wallet}
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value="none">None</MenuItem>
        <MenuItem value="begin">Begin</MenuItem>
        <MenuItem value="eternl">Eternl</MenuItem>
        <MenuItem value="nami">Nami</MenuItem>
        <MenuItem value="typhoncip30">Typhon</MenuItem>
        <MenuItem value="yoroi">Yoroi</MenuItem>
      </TextField>
    </div>
  );
};
