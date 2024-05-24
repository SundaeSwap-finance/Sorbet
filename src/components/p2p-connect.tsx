import DiconnectIcon from "@mui/icons-material/Power";
import ConnectIcon from "@mui/icons-material/PowerOutlined";
import RemoveIcon from "@mui/icons-material/RemoveCircle";
import EmptyDAppIcon from "@mui/icons-material/TerminalOutlined";
import { Box, Card, CardContent, CardMedia, TextField, Typography } from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import { useP2P } from "../../hooks/useP2P";
import { P2PConnection, P2PDapp } from "../../modules/cip45-peer-connect";
import { SorbetIconButton } from "../sorbet-icon-button";
import { ConnectStateComponent } from "./p2p-connect-state";

/** Component with P2P Connection & Peer Id state managed externally  */
export const P2PConnectComponent = () => (
  <>
    <P2PConnectInput />
    <P2PConnectionsList />
  </>
)

/** Component to manage newly entered peerId state manually */
export const P2PConnectInput = () => {
  const [peerId, setPeerId] = useState<string>()
  return (
    <TextField
      fullWidth
      label="Peer Id"
      value={peerId ?? ''}
      style={{ marginBottom: 12, marginTop: 12 }}
      onChange={(e) => setPeerId(e.target.value)}
      InputProps={{
        endAdornment: (
          <P2PConnectButton peerId={peerId} key={0} />
        )
      }}
    />
  )
}

/** Component to manage P2P connect / disconnect commands */
function P2PConnectButton({ peerId }: { peerId?: string }): React.ReactNode {
  const { connectP2P, disconnectP2P, p2pConnections } = useP2P()
  const [isConnected, setIsConnected] = useState(false)
  useEffect(() => {
    if (!peerId)
      return
    setIsConnected(p2pConnections[peerId]?.connection?.connected === true)
  }, [peerId, p2pConnections])
  const disabled = peerId === undefined || peerId === ''
  return <SorbetIconButton
    tooltipTitle={isConnected ? "Disconnect P2P" : "Connect P2P"}
    disabled={disabled}
    color={disabled ? "default" : isConnected ? "success" : "primary"}
    onClick={() => {
      if (!peerId) {
        return
      }
      if (isConnected) {
        disconnectP2P(peerId);
      } else {
        connectP2P(peerId);
      }
    }}
  >
    {isConnected ? <DiconnectIcon /> : <ConnectIcon />}
  </SorbetIconButton>;
}

/** Component to display all current P2P connections & dApps */
const P2PConnectionsList = () => {
  const { p2pConnections, removeP2PConnection } = useP2P() ?? {}
  return (
    <Box>
      {Object.entries(p2pConnections).map(([peerId, c]) => {
        const { seed, connection } = c ?? {}
        return (
          <Box key={peerId}>
            <DAppConnectionCard {...{ peerId, seed, connection, removeP2PConnection }} />
          </Box>
        )
      })}
    </Box>
  )
}

interface DAppConnectionCardProps {
  peerId: string, seed?: string, connection?: P2PConnection, removeP2PConnection: (peerId: string) => void
}
/** Component to display P2P connection & dApp details */
function DAppConnectionCard({ peerId, seed, connection, removeP2PConnection }: DAppConnectionCardProps) {
  const { address: connectionAddress, connected, autoConnect, error, errorMessage, dApp } = connection ?? {}
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column' }}>
      <DAppCardBody dApp={dApp ?? { address: peerId }} />
      <Typography variant="body2" fontSize={10} color="text.secondary" component="div">
        Connection Address: {connectionAddress}
      </Typography>
      <ConnectStateComponent connected={connected} />
      <div>Auto Connect: {autoConnect ? 'enabled' : 'disabled'}</div>
      <div>Seed {seed}</div>
      <div>{(error || errorMessage) && `P2P Error Detected:`}</div>
      <div>{(error || errorMessage) && (errorMessage ?? 'no detail provided')}</div>
      <SorbetIconButton
        tooltipTitle="Remove P2P Connection"
        onClick={() => removeP2PConnection(peerId)}
      >
        <RemoveIcon />
      </SorbetIconButton>
    </Card>
  )
}

/** Component to display P2P dApp details */
function DAppCardBody({ dApp: { name, address: dappAddress, url, identicon } }: { dApp: Partial<P2PDapp> }) {
  const identiconRef = identicon ? useRef<string | null>(identicon)?.current : null;
  return (
    <>
      <Box sx={{ display: 'flex' }}>
        {identiconRef ? <CardMedia
          component="img"
          sx={{ width: '96px', height: '96px' }}
          {...identiconRef ? { image: identiconRef } : {}}
          alt={`${name} - DApp identicon`}
        /> : <EmptyDAppIcon sx={{ width: '96px', height: '96px' }} />}
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <CardContent sx={{ flex: '1 0 auto' }}>
            <Typography component="div" variant="h5">
              {name}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" component="div">
              {url}
            </Typography>
          </CardContent>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pl: 1, pb: 1 }}>
          <P2PConnectButton peerId={dappAddress} />
        </Box>
      </Box>
      <Typography variant="body2" fontSize={10} color="text.secondary" component="div">
        dApp Address (Peer ID): {dappAddress}
      </Typography>
    </>
  )
}