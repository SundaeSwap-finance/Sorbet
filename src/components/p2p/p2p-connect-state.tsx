import { Chip } from "@mui/material";
import React from "react";

/** Component to display P2P Connection Status */
export const ConnectStateComponent = ({ connected }: { connected?: boolean }) => (
  <Chip
    label={connected ? "Connected" : "Disconnected"}
    size="small"
    color={connected ? "success" : "warning"}
    variant={connected ? "filled" : "outlined"}
  />
);
