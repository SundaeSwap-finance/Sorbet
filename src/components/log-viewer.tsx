import React, { useCallback, useEffect, useRef, useState, CSSProperties } from "react";
import { WalletLog } from "../modules/walletLog";
import {
  getWalletLogScrollback,
  onWalletLogsChanged,
  parseWalletLogScrollback,
  retrieveWalletLogs,
  saveWalletLogScrollback,
} from "../modules/walletLogStorageHandler";
import { Box, TextField, Typography } from "@mui/material";
import { Log } from "../utils/log_util";

/** Keys from (created, occurrence) so rows keep identity when older entries are trimmed. */
const logKeys = (logs: WalletLog[]): string[] => {
  const seen = new Map<number, number>();
  return logs.map(({ created }) => {
    const n = seen.get(created) ?? 0;
    seen.set(created, n + 1);
    return `${created}-${n}`;
  });
};

export const LogViewerComponent = (): JSX.Element => {
  const [scrollbackDraft, setScrollbackDraft] = useState<string | undefined>(undefined);
  const [walletLogs, setWalletLogs] = useState<WalletLog[]>([]);
  const latestRead = useRef(0);

  const reload = useCallback(() => {
    const request = ++latestRead.current;
    retrieveWalletLogs().then(
      (logs) => {
        if (request === latestRead.current) setWalletLogs(logs);
      },
      (error) => Log.E(error instanceof Error ? error : String(error))
    );
  }, []);

  useEffect(() => {
    reload();
    getWalletLogScrollback().then(
      (scrollback) => setScrollbackDraft(String(scrollback)),
      (error) => Log.E(error instanceof Error ? error : String(error))
    );
    return onWalletLogsChanged(reload);
  }, [reload]);

  const onScrollbackChange = (value: string) => {
    setScrollbackDraft(value);
    if (value.trim() === "") return;
    saveWalletLogScrollback(value).then(undefined, (error) =>
      Log.E(error instanceof Error ? error : String(error))
    );
  };
  const keys = logKeys(walletLogs);
  return (
    <>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Typography component="h2" variant="h6" fontWeight="bold">
          Log Viewer
        </Typography>
        <TextField
          size="small"
          sx={{ width: "10ch" }}
          label="Scroll-Back"
          variant="outlined"
          type="number"
          value={scrollbackDraft ?? ""}
          disabled={scrollbackDraft === undefined}
          inputProps={{ min: 1, max: 1000, step: 1 }}
          onChange={({ currentTarget: { value } }) => onScrollbackChange(value)}
          onBlur={() => setScrollbackDraft(String(parseWalletLogScrollback(scrollbackDraft)))}
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        {walletLogs.map((log, i) => (
          <LogRow key={keys[i]} {...log} />
        ))}
      </Box>
    </>
  );
};
interface LogRowProps extends WalletLog {}
const LogRow = ({ methodName, args, result, created, origin }: LogRowProps): JSX.Element => (
  <>
    <Box sx={{ ...logRowStyle, ...dateRowStyle }}>[{new Date(created).toString()}]</Box>
    <Box sx={{ ...logRowStyle, ...methodCallRowStyle }}>
      <div>
        <Box component="span" sx={{ ...terminalPromptStyle, color: "success.main" }}>
          &gt;
        </Box>{" "}
        {methodName}
        {origin && (
          <Box component="span" sx={{ color: "text.secondary", fontSize: "0.85em", ml: 1 }}>
            {origin}
          </Box>
        )}
      </div>
      <div>
        ({JSON.stringify(args)}){" "}
        <Box component="span" sx={{ ...terminalPromptStyle, color: "error.main" }}>
          =&gt;
        </Box>
      </div>
      {!Array.isArray(result) && <div>{JSON.stringify(result)}</div>}
    </Box>
    {Array.isArray(result) && (
      <Box sx={{ ...logRowStyle, ...resultRowStyle }}>{JSON.stringify(result)}</Box>
    )}
    <Box sx={rowPadStyle} />
  </>
);
// LogRow CSS Styles
const logRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 1,
  whiteSpace: "nowrap",
  fontSize: 14,
};
const dateRowStyle: CSSProperties = {
  fontFamily: "monospace",
  fontSize: 10,
};
const methodCallRowStyle: CSSProperties = {
  fontFamily: "Consolas",
  fontSize: 14,
};
const resultRowStyle: CSSProperties = {
  fontFamily: "Consolas",
  fontSize: 14,
};
const rowPadStyle: CSSProperties = {
  marginBottom: "6px",
};
const terminalPromptStyle: CSSProperties = {
  fontSize: "8px",
  fontWeight: "bold",
  verticalAlign: "middle",
};
