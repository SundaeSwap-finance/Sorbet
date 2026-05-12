import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import { Box, MenuItem, TextField, Typography } from "@mui/material";
import React from "react";

interface WalletOption {
  value: string;
  label: string;
}

const walletOptions: WalletOption[] = [
  { value: "none", label: "None" },
  { value: "begin", label: "Begin" },
  { value: "eternl", label: "Eternl" },
  { value: "nami", label: "Nami" },
  { value: "typhoncip30", label: "Typhon" },
  { value: "yoroi", label: "Yoroi" },
  { value: "lace", label: "Lace" },
  { value: "flint", label: "Flint" },
  { value: "vespr", label: "Vespr" },
];

interface WalletSelectProps {
  label?: string;
  wallet: string;
  onChange: (newValue: string) => void;
}

export const WalletSelect: React.FC<WalletSelectProps> = ({ wallet, onChange, label }) => {
  return (
    <TextField
      select
      fullWidth
      label={label ?? "Select Wallet"}
      value={wallet}
      onChange={(e) => onChange(e.target.value)}
    >
      {walletOptions.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {option.value !== "none" && (
              <AccountBalanceWalletIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            )}
            <Typography variant="body2">{option.label}</Typography>
          </Box>
        </MenuItem>
      ))}
    </TextField>
  );
};
