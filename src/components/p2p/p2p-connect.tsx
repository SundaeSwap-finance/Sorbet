import AddLinkIcon from "@mui/icons-material/AddLink";
import DeleteIcon from "@mui/icons-material/Delete";
import DisconnectIcon from "@mui/icons-material/LinkOff";
import ConnectIcon from "@mui/icons-material/Power";
import DevicesIcon from "@mui/icons-material/DevicesOther";
import QrCodeIcon from "@mui/icons-material/QrCode2";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardMedia,
  Chip,
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { useP2P } from "../../hooks/useP2P";
import { P2PConnection, P2PDapp } from "../../modules/cip45-peer-connect";

/** Component with P2P Connection & Peer Id state managed externally  */
export const P2PConnectComponent = () => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      minHeight: "100%",
      bgcolor: "background.default",
    }}
  >
    {/* Header */}
    <Box
      sx={{
        p: 3,
        pb: 2,
        background: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)",
        color: "white",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <DevicesIcon />
        <Typography variant="h6" fontWeight={700}>
          P2P Connections
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ opacity: 0.9 }}>
        Connect to dApps on other devices using CIP-45
      </Typography>
    </Box>

    {/* Content */}
    <Box sx={{ p: 2, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
      <P2PConnectInput />
      <P2PConnectionsList />
    </Box>
  </Box>
);

/** Component to manage newly entered peerId state manually */
export const P2PConnectInput = () => {
  const [peerId, setPeerId] = useState<string>("");
  const { connectP2P } = useP2P();

  const handleConnect = () => {
    if (peerId.trim()) {
      connectP2P(peerId.trim());
      setPeerId("");
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: "2px dashed",
        borderColor: "grey.200",
        borderRadius: 3,
        bgcolor: "grey.50",
        transition: "all 0.2s",
        "&:focus-within": {
          borderColor: "primary.main",
          bgcolor: "white",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <QrCodeIcon sx={{ color: "primary.main", fontSize: 20 }} />
        <Typography variant="body2" fontWeight={600}>
          Add Connection
        </Typography>
      </Box>
      <TextField
        fullWidth
        size="small"
        placeholder="Paste peer ID from the dApp..."
        value={peerId}
        onChange={(e) => setPeerId(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleConnect()}
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: "white",
            fontFamily: "monospace",
            fontSize: 13,
          },
        }}
      />
      <Button
        fullWidth
        variant="contained"
        disabled={!peerId.trim()}
        onClick={handleConnect}
        startIcon={<AddLinkIcon />}
        sx={{ mt: 1.5 }}
      >
        Connect to dApp
      </Button>
    </Paper>
  );
};

/** Component to manage P2P connect / disconnect commands */
function P2PConnectButton({ peerId }: { peerId?: string }): React.ReactNode {
  const { connectP2P, disconnectP2P, p2pConnections } = useP2P();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!peerId) return;
    setIsConnected(p2pConnections[peerId]?.connection?.connected === true);
  }, [peerId, p2pConnections]);

  const disabled = peerId === undefined || peerId === "";

  return (
    <Tooltip title={isConnected ? "Disconnect" : "Reconnect"}>
      <span>
        <IconButton
          disabled={disabled}
          size="small"
          onClick={() => {
            if (!peerId) return;
            if (isConnected) {
              disconnectP2P(peerId);
            } else {
              connectP2P(peerId);
            }
          }}
          sx={{
            bgcolor: isConnected ? "error.50" : "primary.50",
            color: isConnected ? "error.main" : "primary.main",
            "&:hover": {
              bgcolor: isConnected ? "error.100" : "primary.100",
            },
          }}
        >
          {isConnected ? <DisconnectIcon fontSize="small" /> : <ConnectIcon fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
  );
}

/** Component to display all current P2P connections & dApps */
const P2PConnectionsList = () => {
  const { p2pConnections, removeP2PConnection } = useP2P() ?? {};
  const connections = Object.entries(p2pConnections);

  if (connections.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: 4,
          color: "text.secondary",
        }}
      >
        <Avatar
          sx={{
            width: 64,
            height: 64,
            bgcolor: "grey.100",
            mb: 2,
          }}
        >
          <DevicesIcon sx={{ fontSize: 32, color: "grey.400" }} />
        </Avatar>
        <Typography variant="body1" fontWeight={500} color="text.primary">
          No connections yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, textAlign: "center" }}>
          Paste a peer ID from a dApp to connect
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="body2" fontWeight={600} color="text.secondary">
          Connected dApps
        </Typography>
        <Chip label={connections.length} size="small" color="primary" />
      </Box>
      {connections.map(([peerId, c]) => {
        const { seed, connection } = c ?? {};
        return (
          <DAppConnectionCard
            key={peerId}
            peerId={peerId}
            seed={seed}
            connection={connection}
            removeP2PConnection={removeP2PConnection}
          />
        );
      })}
    </Box>
  );
};

interface DAppConnectionCardProps {
  peerId: string;
  seed?: string;
  connection?: P2PConnection;
  removeP2PConnection: (peerId: string) => void;
}

/** Component to display P2P connection & dApp details */
function DAppConnectionCard({
  peerId,
  connection,
  removeP2PConnection,
}: DAppConnectionCardProps) {
  const { connected, error, errorMessage, dApp } = connection ?? {};

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        border: "1px solid",
        borderColor: connected ? "success.200" : "grey.200",
        bgcolor: connected ? "success.50" : "white",
        overflow: "hidden",
        transition: "all 0.2s",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", p: 2, gap: 2 }}>
        <DAppIcon dApp={dApp} connected={connected} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body1" fontWeight={600} noWrap>
              {dApp?.name || "Unknown dApp"}
            </Typography>
            <Chip
              label={connected ? "Live" : "Offline"}
              size="small"
              color={connected ? "success" : "default"}
              sx={{ height: 20, fontSize: 11 }}
            />
          </Box>
          {dApp?.url && (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {dApp.url}
            </Typography>
          )}
          <Typography
            variant="caption"
            sx={{ fontFamily: "monospace", fontSize: 10, color: "text.disabled" }}
            noWrap
            component="div"
          >
            {peerId.slice(0, 16)}...{peerId.slice(-6)}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 0.5 }}>
          <P2PConnectButton peerId={dApp?.address || peerId} />
          <Tooltip title="Remove">
            <IconButton
              size="small"
              onClick={() => removeP2PConnection(peerId)}
              sx={{
                bgcolor: "grey.100",
                "&:hover": { bgcolor: "error.100", color: "error.main" },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {(error || errorMessage) && (
        <Alert severity="error" sx={{ borderRadius: 0, py: 0.5 }}>
          {errorMessage || "Connection error"}
        </Alert>
      )}
    </Card>
  );
}

/** Component to display dApp icon/identicon */
function DAppIcon({ dApp, connected }: { dApp?: P2PDapp; connected?: boolean }) {
  if (dApp?.identicon) {
    return (
      <Box sx={{ position: "relative" }}>
        <CardMedia
          component="img"
          sx={{ width: 44, height: 44, borderRadius: 2 }}
          image={dApp.identicon}
          alt={`${dApp?.name || "dApp"} icon`}
        />
        {connected && (
          <Box
            sx={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 14,
              height: 14,
              bgcolor: "success.main",
              borderRadius: "50%",
              border: "2px solid white",
            }}
          />
        )}
      </Box>
    );
  }

  return (
    <Avatar
      sx={{
        width: 44,
        height: 44,
        bgcolor: connected ? "primary.100" : "grey.100",
        color: connected ? "primary.main" : "grey.500",
      }}
    >
      <DevicesIcon />
    </Avatar>
  );
}
