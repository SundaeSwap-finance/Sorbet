import LanguageIcon from "@mui/icons-material/Language";
import KeyIcon from "@mui/icons-material/VpnKey";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import { Alert, Box, Button, Chip, Paper, Snackbar, Switch, TextField, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { SitePermissions, loadSitePermissions, onSitePermissionsChanged, revokeSite } from "../modules/sitePermissions";
import { Settings, loadSettings, saveSettings } from "../settings";

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Origins that may use Sorbet, with what each may do, and a way to remove them. Live across contexts. */
const ConnectedSites: React.FC = () => {
  const [sites, setSites] = useState<SitePermissions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onSitePermissionsChanged((all) => active && setSites(all));
    loadSitePermissions().then(
      (all) => active && setSites((current) => current ?? all),
      (e) => active && setError(`Could not load connected sites: ${errorMessage(e)}`)
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const remove = (origin: string) =>
    revokeSite(origin).then(
      () => setError(null),
      (e) => setError(`Could not remove ${origin}: ${errorMessage(e)}`)
    );

  const origins = Object.keys(sites ?? {}).sort();
  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <LanguageIcon sx={{ color: "primary.main", fontSize: 20 }} />
        <Typography variant="body1" fontWeight={600}>
          Connected sites
        </Typography>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}
      {sites !== null && origins.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          No sites have access. Sites you approve will appear here.
        </Typography>
      )}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {sites &&
          origins.map((origin) => (
            <Box key={origin} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                  {origin}
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5, mt: 0.5 }}>
                  {sites[origin].connect && <Chip size="small" label="Wallet access" />}
                  {sites[origin].hooks && <Chip size="small" label="Address hooks" />}
                </Box>
              </Box>
              <Button size="small" color="error" onClick={() => remove(origin)}>
                Remove
              </Button>
            </Box>
          ))}
      </Box>
    </Paper>
  );
};

const FORM_KEYS = ["blockfrostMainnetApiKey", "blockfrostPreviewApiKey", "shouldScanForAddresses"] as const;
type FormValues = Pick<Settings, (typeof FORM_KEYS)[number]>;

type Status = { kind: "saved" } | { kind: "error"; message: string } | null;

/** The API key / behavior settings form shared by the popup Settings screen and the options page. */
export const SettingsForm: React.FC = () => {
  const [values, setValues] = useState<FormValues | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    let active = true;
    loadSettings(FORM_KEYS).then(
      (loaded) => active && setValues(loaded),
      (error) => active && setLoadError(error instanceof Error ? error.message : String(error))
    );
    return () => {
      active = false;
    };
  }, []);

  const update = (patch: Partial<FormValues>) => setValues((current) => current && { ...current, ...patch });

  const save = async () => {
    if (!values) return;
    setSaving(true);
    try {
      await saveSettings(values);
      setStatus({ kind: "saved" });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {loadError && <Alert severity="error">Could not load settings: {loadError}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <KeyIcon sx={{ color: "primary.main", fontSize: 20 }} />
          <Typography variant="body1" fontWeight={600}>
            API Keys
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
          Enter your Blockfrost API keys for address lookups and handle resolution.{" "}
          <a href="https://blockfrost.io" target="_blank" rel="noopener noreferrer" style={{ color: "#7C3AED" }}>
            Get free keys
          </a>
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            label="Mainnet API Key"
            placeholder="mainnetXXXXXXXX..."
            value={values?.blockfrostMainnetApiKey ?? ""}
            disabled={!values}
            onChange={(e) => update({ blockfrostMainnetApiKey: e.target.value })}
            type="password"
            InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }}
          />
          <TextField
            fullWidth
            size="small"
            label="Preview (Testnet) API Key"
            placeholder="previewXXXXXXXX..."
            value={values?.blockfrostPreviewApiKey ?? ""}
            disabled={!values}
            onChange={(e) => update({ blockfrostPreviewApiKey: e.target.value })}
            type="password"
            InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }}
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <VisibilityIcon sx={{ color: "primary.main", fontSize: 20 }} />
          <Typography variant="body1" fontWeight={600}>
            Behavior
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              Scan for Addresses
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Auto-detect Cardano addresses on pages
            </Typography>
          </Box>
          <Switch
            checked={values?.shouldScanForAddresses ?? false}
            disabled={!values}
            onChange={(e) => update({ shouldScanForAddresses: e.target.checked })}
          />
        </Box>
      </Paper>

      <ConnectedSites />

      <Button variant="contained" fullWidth disabled={!values || saving} onClick={save}>
        Save Settings
      </Button>

      <Snackbar
        open={status !== null}
        autoHideDuration={status?.kind === "error" ? 6000 : 2000}
        onClose={() => setStatus(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={status?.kind === "error" ? "error" : "success"} onClose={() => setStatus(null)}>
          {status?.kind === "error" ? `Could not save settings: ${status.message}` : "Settings saved"}
        </Alert>
      </Snackbar>
    </Box>
  );
};
