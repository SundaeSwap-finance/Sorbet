import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import { Box, MenuItem, TextField, Typography } from "@mui/material";
import React from "react";
import { WALLET_IDS, WalletId, isWalletId } from "../types";

const WALLET_LABELS: Record<WalletId, string> = {
  begin: "Begin",
  eternl: "Eternl",
  nami: "Nami",
  typhoncip30: "Typhon",
  yoroi: "Yoroi",
  lace: "Lace",
  flint: "Flint",
  vespr: "Vespr",
};

/** MenuItem value standing for "no wallet" (null). */
const NONE = "none";

interface WalletSelectProps {
  label?: string;
  wallet: WalletId | null;
  onChange: (newValue: WalletId | null) => void;
}

export const WalletSelect: React.FC<WalletSelectProps> = ({ wallet, onChange, label }) => (
  <TextField
    select
    fullWidth
    label={label ?? "Select Wallet"}
    value={wallet ?? NONE}
    onChange={(e) => onChange(isWalletId(e.target.value) ? e.target.value : null)}
  >
    <MenuItem value={NONE}>
      <Typography variant="body2">None</Typography>
    </MenuItem>
    {WALLET_IDS.map((id) => (
      <MenuItem key={id} value={id}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 18, color: "text.secondary" }} />
          <Typography variant="body2">{WALLET_LABELS[id]}</Typography>
        </Box>
      </MenuItem>
    ))}
  </TextField>
);
