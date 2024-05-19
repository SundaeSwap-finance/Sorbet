import DiconnectIcon from "@mui/icons-material/Power";
import ConnectIcon from "@mui/icons-material/PowerOutlined";
import { Alert, Box, Card, CardContent, CardMedia, TextField, Typography } from "@mui/material";
import P2PRefreshingIcon from '@mui/material/CircularProgress';
import React from "react";
import { P2PConnection, useP2P } from "../hooks/useP2P";
import { SorbetIconButton } from "./sorbet-icon-button";

/** Component with P2P Connection & Peer Id state managed externally  */

export const P2PConnections = () => {
  const { isReady, p2pConnections } = useP2P()

  return isReady && (
    <>
      <P2PConnectInput />
      {p2pConnections.length < 1 && <ConnectStateComponent />}
      <P2PConnectionsList />
      <P2PConnectionStatus />
    </>
  )
}

const P2PConnectionsList = () => {
  const { p2pConnections } = useP2P() ?? {}
  return (
    <Box>
      {p2pConnections?.map(c => (
        <Box key={c.address}>
          <DAppInfosCard  {...{ ...c }} />
        </Box>
      ))}
    </Box>
  )
}
export const P2PConnectInput = () => {
  const { peerId, savePeerId } = useP2P()
  return (
    <TextField
      fullWidth
      label="Peer Id"
      value={peerId ?? ''}
      style={{ marginBottom: 12, marginTop: 12 }}
      onChange={(e) => savePeerId(e.target.value)}
      InputProps={{
        endAdornment: (
          <P2PConnectButton />
        )
      }}
    />
  )
}

/**
 * Component to display current P2P Connection Status
 */
const ConnectStateComponent = () => {
  const { isConnected, isConnecting, connectionState } = useP2P()
  return (
    <Box sx={{ display: 'flex', gap: 3 }}>
      <Alert severity={isConnected ? 'success' : isConnecting ? 'info' : 'warning'}>{connectionState[0].toUpperCase() + connectionState.slice(1)}</Alert>
      <span>{isConnecting && <P2PRefreshingIcon />}</span>
    </Box>
  )
}
const P2PConnectionStatus = () => {
  const { connectMessage, p2pSeed } = useP2P()
  return (
    <>
      <Box>
        {p2pSeed && <Box sx={{ whiteSpace: 'nowrap' }}>p2pSeed: {p2pSeed}</Box>}
      </Box>
      <div>
        {connectMessage?.error && connectMessage?.errorMessage ? `P2P Error: ${connectMessage.error} ${connectMessage.errorMessage}` : undefined}
      </div>
    </>
  )
}
function P2PConnectButton(): React.ReactNode {
  const { isConnected, isConnecting, connectP2P, disconnectP2P, peerId } = useP2P()
  return <SorbetIconButton
    key={0}
    tooltipTitle={isConnected || isConnecting ? "Disconnect P2P" : "Connect P2P"}
    disabled={peerId === undefined || peerId === ''}
    color={peerId === undefined && peerId === '' ? "default" : isConnected ? "success" : "primary"}
    onClick={() => {
      if (isConnected || isConnecting) {
        disconnectP2P();
      } else {
        connectP2P();
      }
    }}
  >
    {isConnected || isConnecting ? <DiconnectIcon /> : <ConnectIcon />}
  </SorbetIconButton>;
}

const DAppInfosCard = ({ name, address, url, identicon }: P2PConnection) => {
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column' }}>
      <Card sx={{ display: 'flex' }}>
        <CardMedia
          component="img"
          sx={{ width: '96px', height: '96px' }}
          {...identicon?.current ? { image: identicon?.current } : {}}
          alt={`${name} - DApp identicon`}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <CardContent sx={{ flex: '1 0 auto' }}>
            <Typography component="div" variant="h5">
              {name}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" component="div">
              {url}
            </Typography>
          </CardContent>
          <ConnectStateComponent />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pl: 1, pb: 1 }}>
          <P2PConnectButton />
          {/* <IconButton aria-label="previous">
            {theme.direction === 'rtl' ? <SkipNextIcon /> : <SkipPreviousIcon />}
          </IconButton>
          <IconButton aria-label="play/pause">
            <PlayArrowIcon sx={{ height: 38, width: 38 }} />
          </IconButton>
          <IconButton aria-label="next">
            {theme.direction === 'rtl' ? <SkipPreviousIcon /> : <SkipNextIcon />}
          </IconButton> */}
        </Box>
      </Card>
      <Typography variant="body2" color="text.secondary" component="div">
        Address: {address}
      </Typography>
    </Card>
  )
}
