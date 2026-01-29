import { Box, CssBaseline, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import React from "react";
import { createRoot } from "react-dom/client";
import { LogViewerComponent } from "../components/log-viewer";
import { sorbetTheme } from "../theme";

const LogDevTool = () => (
  <ThemeProvider theme={sorbetTheme}>
    <CssBaseline />
    <Box sx={{ p: 2, minHeight: "100vh", bgcolor: "background.default" }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Sorbet Logs
      </Typography>
      <LogViewerComponent />
    </Box>
  </ThemeProvider>
);

const root = createRoot(document.getElementById("log_devtool_root")!);

root.render(
  <React.StrictMode>
    <LogDevTool />
  </React.StrictMode>
);
