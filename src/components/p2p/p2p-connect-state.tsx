import { Alert, Box } from "@mui/material";
import React from "react";

/** Component to display P2P Connection Status */
export const ConnectStateComponent = ({ connected }: { connected?: boolean }) => (
  <Box sx={{ display: 'flex', gap: 3 }}>
    <Alert severity={connected ? 'success' : 'warning'}>{connected ? 'Connected' : 'Disconnected'}</Alert>
  </Box>
)