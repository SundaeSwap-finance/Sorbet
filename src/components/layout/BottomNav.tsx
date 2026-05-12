import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import BuildIcon from "@mui/icons-material/BuildOutlined";
import CableIcon from "@mui/icons-material/CableOutlined";
import ContactsIcon from "@mui/icons-material/ContactsOutlined";
import { BottomNavigation, BottomNavigationAction, Box } from "@mui/material";
import React from "react";
import { EView } from "../../types";

interface BottomNavProps {
  value: EView;
  onChange: (view: EView) => void;
  isConnected?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ value, onChange, isConnected }) => {
  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
      }}
    >
      <BottomNavigation
        value={value}
        onChange={(_, newValue) => onChange(newValue)}
        showLabels
      >
        <BottomNavigationAction
          label="Wallet"
          value={EView.WALLET}
          icon={<AccountBalanceWalletIcon />}
        />
        <BottomNavigationAction
          label="Contacts"
          value={EView.CONTACTS}
          icon={<ContactsIcon />}
        />
        <BottomNavigationAction
          label="Connect"
          value={EView.CONNECT}
          icon={<CableIcon />}
          sx={{
            "&.Mui-selected": {
              color: isConnected ? "success.main" : "primary.main",
            },
          }}
        />
        <BottomNavigationAction
          label="Tools"
          value={EView.TOOLS}
          icon={<BuildIcon />}
        />
      </BottomNavigation>
    </Box>
  );
};
