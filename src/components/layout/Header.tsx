import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import { Avatar, Box, IconButton, Tooltip, Typography } from "@mui/material";
import React from "react";

interface HeaderProps {
  showBack?: boolean;
  title?: string;
  onBack?: () => void;
  onSettingsClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ showBack, title, onBack, onSettingsClick }) => {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 2,
        py: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {showBack ? (
          <IconButton size="small" onClick={onBack} sx={{ ml: -1 }}>
            <ArrowBackIcon />
          </IconButton>
        ) : (
          <Avatar
            src={chrome.runtime.getURL("sorbet.png")}
            alt="Sorbet"
            sx={{
              width: 32,
              height: 32,
              border: "2px solid",
              borderColor: "primary.main",
              "& img": {
                padding: "4px",
              },
            }}
          />
        )}
        <Typography
          variant="h3"
          sx={{
            fontWeight: 600,
            background: showBack ? "none" : "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)",
            WebkitBackgroundClip: showBack ? "unset" : "text",
            WebkitTextFillColor: showBack ? "inherit" : "transparent",
          }}
        >
          {title || "Sorbet"}
        </Typography>
      </Box>

      {!showBack && (
        <Tooltip title="Settings">
          <IconButton
            size="small"
            onClick={onSettingsClick}
            sx={{ color: "text.secondary" }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
