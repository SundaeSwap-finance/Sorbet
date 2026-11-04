import { Alert, Box, Button, Chip, CssBaseline, Paper, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { addressNetworkLabel, approvalHeadline, decisionOptions, originWarning } from "./approvalView";
import {
  APPROVAL_KEEPALIVE_PORT,
  ApprovalDecision,
  ApprovalRequest,
  BackgroundAction,
  callBackground,
  runtimeTransport,
} from "./protocol";
import { sorbetTheme } from "./theme";

const KEEPALIVE_INTERVAL_MS = 20_000;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

type Load = { kind: "loading" } | { kind: "ready"; request: ApprovalRequest } | { kind: "expired"; message: string };

/** Keeps the service worker alive while the user decides. */
function useKeepalive(): void {
  useEffect(() => {
    const port = chrome.runtime.connect({ name: APPROVAL_KEEPALIVE_PORT });
    const timer = setInterval(() => port.postMessage({ type: "keepalive" }), KEEPALIVE_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      port.disconnect();
    };
  }, []);
}

const monoBreak = { fontFamily: "monospace", wordBreak: "break-all" } as const;

const ApprovalWindow: React.FC = () => {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  useKeepalive();

  useEffect(() => {
    const approvalId = location.hash.slice(1);
    if (!approvalId) {
      setLoad({ kind: "expired", message: "No approval id in the window address." });
      return;
    }
    callBackground(runtimeTransport, BackgroundAction.APPROVAL_GET, { approvalId }).then(
      (request) => setLoad({ kind: "ready", request }),
      (error) => setLoad({ kind: "expired", message: errorMessage(error) })
    );
  }, []);

  const decide = async (request: ApprovalRequest, decision: ApprovalDecision) => {
    setSending(true);
    setSendError(null);
    try {
      await callBackground(runtimeTransport, BackgroundAction.APPROVAL_DECIDE, {
        approvalId: request.id,
        decision,
      });
      window.close();
    } catch (error) {
      setSendError(errorMessage(error));
      setSending(false);
    }
  };

  if (load.kind === "loading") {
    return <Box sx={{ p: 3 }}><Typography color="text.secondary">Loading request…</Typography></Box>;
  }
  if (load.kind === "expired") {
    return (
      <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
        <Alert severity="warning">This request has expired or was already answered.</Alert>
        <Typography variant="caption" color="text.secondary">{load.message}</Typography>
        <Button variant="outlined" onClick={() => window.close()}>Close</Button>
      </Box>
    );
  }

  const { request } = load;
  const warning = originWarning(request.origin);
  const network = request.address ? addressNetworkLabel(request.address) : null;

  return (
    <Box sx={{ p: 3, height: "100vh", display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h3">Approval request</Typography>

      <Paper sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">Requested by site</Typography>
        <Typography sx={{ ...monoBreak, fontSize: 18, fontWeight: 700 }}>{request.origin}</Typography>
      </Paper>

      {warning && <Alert severity="warning">{warning}</Alert>}

      <Typography variant="body2">This site {approvalHeadline(request.kind)}</Typography>

      {request.address && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography variant="caption" color="text.secondary">Address</Typography>
            <Chip
              size="small"
              label={network ?? "Unknown network"}
              color={network === "Mainnet" ? "success" : "default"}
            />
          </Box>
          <Typography sx={{ ...monoBreak, fontSize: 13 }}>{request.address}</Typography>
        </Paper>
      )}

      {sendError && <Alert severity="error">Could not send your decision: {sendError}</Alert>}

      <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
        {decisionOptions(request.kind).map(({ decision, label, primary }) => (
          <Button
            key={decision}
            variant={primary ? "contained" : "outlined"}
            color={decision === "deny" ? "error" : "primary"}
            fullWidth
            disabled={sending}
            onClick={() => decide(request, decision)}
          >
            {label}
          </Button>
        ))}
      </Box>
    </Box>
  );
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={sorbetTheme}>
      <CssBaseline />
      <ApprovalWindow />
    </ThemeProvider>
  </React.StrictMode>
);
