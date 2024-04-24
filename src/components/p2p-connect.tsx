import { IConnectMessage } from "@fabianbormann/cardano-peer-connect/dist/src/types";
import P2PConnectedIcon from "@mui/icons-material/Power";
import P2PNotConnectedIcon from "@mui/icons-material/PowerOutlined";
import P2PRefreshingIcon from "@mui/icons-material/RefreshOutlined";
import { IconButton, TextField, Tooltip } from "@mui/material";
import React, { MutableRefObject, useEffect, useRef, useState } from "react";
import { initP2PClient } from "../modules/cip45-peer-connect";

export const StorageKeys = {
  PEER_ID_STORAGE: "peerId", PEER_SEED_STORAGE: "p2pSeed"
}

/** Component with P2P Connection & Peer Id state managed externally  */
export const P2PConnections = () => {
  /** Retrieve P2P values from storage */
  useEffect(() => {
    chrome.storage.sync.get(
      [StorageKeys.PEER_ID_STORAGE, StorageKeys.PEER_SEED_STORAGE],
      function (result) {
        _setPeerId(result[StorageKeys.PEER_ID_STORAGE] ?? "");
        _setP2pSeed(result[StorageKeys.PEER_SEED_STORAGE]);
      }
    );
  }, []);
  /** Connect storage to state */
  const [peerId, _setPeerId] = useState<string>("")
  const setPeerId = (peerId: string) => {
    chrome.storage.sync.set({ [StorageKeys.PEER_ID_STORAGE]: peerId }, function () {
      _setPeerId(peerId)
    });
  }
  const [p2pSeed, _setP2pSeed] = useState<string>()
  const setP2pSeed = (p2pSeed: string) => {
    chrome.storage.sync.set({ [StorageKeys.PEER_SEED_STORAGE]: p2pSeed }, function () {
      _setP2pSeed(p2pSeed)
    });
  }
  const [connectMessage, _setConnectedMessage] = useState<IConnectMessage>()
  const setConnectedMessage = (m?: IConnectMessage) => {
    _setConnectedMessage(m)
    setIsConnecting(false)
  }
  const [isConnecting, setIsConnecting] = useState(true)
  const identicon = useRef<string | null>(null);


  const setConnectionState = (m: IConnectMessage) => {
    identicon.current = p2pClient.getIdenticon()
    setConnectedMessage(m)
  }
  const clearConnectionState = () => {
    identicon.current = null
    setConnectedMessage(undefined)
  }

  const [p2pClient, _setP2pClient] = useState(() => {
    /** Setup Exit Listeners to Disconnect */
    window.addEventListener('beforeunload', (event: any) => {
      if (p2pClient) {
        p2pClient?.disconnect(peerId!);
      }
    })
    return initP2PConnectClient(clearConnectionState, setConnectionState, p2pSeed)
  })
  const disconnectP2P = () => {
    p2pClient?.disconnect(peerId)
    clearConnectionState()
  }
  const connectP2P = () => {
    setIsConnecting(true)
    if (p2pClient && peerId && peerId !== "") {
      const seed = p2pClient.connect(peerId)
      setP2pSeed(seed)
    } else {
      setIsConnecting(false)
    }
  }

  useEffect(() => {
    connectP2P()
  }, [p2pClient, peerId])

  const p2pIsConnected = isConnecting ? undefined : connectMessage !== undefined;

  return (
    <>
      <P2PConnectInput {...{ p2pIsConnected, connectP2P, disconnectP2P, peerId, setPeerId }} />
      <P2PConnectionStatus {...{ isConnecting, connectMessage, identicon, p2pSeed }} />
      {/* <DemoHome /> */}
    </>
  )
}

const initP2PConnectClient = (
  clearConnectionState: () => void,
  setConnectionState: (m: IConnectMessage) => void,
  p2pSeed?: string
) => {

  const p2pClient = initP2PClient(p2pSeed);

  /** Setup connection status listeners */
  p2pClient.setOnConnect((connectMessage: IConnectMessage) => {
    console.log('connect', connectMessage);

    setConnectionState(connectMessage)
  });

  p2pClient.setOnDisconnect((connectMessage: IConnectMessage) => {
    console.log('disconnect', connectMessage)
    clearConnectionState()
  });

  p2pClient.setOnServerShutdown((connectMessage: IConnectMessage) => {
    console.log('server shutdown', connectMessage);
    clearConnectionState()
  });

  p2pClient.setOnApiInject((connectMessage: IConnectMessage) => {
    console.log('on api inject message', connectMessage);
  });
  return p2pClient
}

interface P2PConnectInputProps {
  p2pIsConnected?: boolean,
  connectP2P: () => void,
  disconnectP2P: () => void,
  peerId?: string, setPeerId: (peerId: string) => void
}
export const P2PConnectInput = ({ p2pIsConnected, connectP2P, disconnectP2P, peerId, setPeerId }: P2PConnectInputProps) => (
  <TextField
    fullWidth
    label="Peer Id"
    value={peerId}
    style={{ marginBottom: 12, marginTop: 12 }}
    onChange={(e) => setPeerId(e.target.value)}
    InputProps={{
      endAdornment: (
        <>
          <Tooltip title={p2pIsConnected ? "disconnect p2p" : "connect p2p"}
            style={{ marginRight: 6 }}>
            <IconButton
              key={2}
              aria-label={"Connect to dApp ussing Peer ID"}
              size="small"
              color={"primary"}
              onClick={() => {
                if (p2pIsConnected) {
                  disconnectP2P()
                } else {
                  if (peerId)
                    connectP2P()
                }
              }}
            >
              {p2pIsConnected ? <P2PConnectedIcon /> : <P2PNotConnectedIcon />}
            </IconButton>
          </Tooltip>
          {/* {p2pIsConnected === undefined && <P2PRefreshingIcon />} */}
        </>
      )
    }}
  />
)

/**
 * Component to display current P2P Connection Status
 * @param param0 
 * @returns 
 */
interface P2PConnectionStatusProps {
  isConnecting: boolean, connectMessage?: IConnectMessage, identicon: MutableRefObject<string | null>, p2pSeed?: string
}
const P2PConnectionStatus = ({ isConnecting, connectMessage, identicon, p2pSeed }: P2PConnectionStatusProps) => (
  <>
    <div>{isConnecting && <P2PRefreshingIcon />} {printConnectMessage(isConnecting, connectMessage)}</div>
    {identicon.current && (
      <div>
        <img src={identicon.current} alt={'identicon'} />
      </div>
    )}
    <div>p2pSeed: {p2pSeed}</div>
  </>
)
/**
 * Helper to display connection message details
 * @param isConnecting 
 * @param connectMessage 
 * @returns 
 */
const printConnectMessage = (isConnecting: boolean, connectMessage?: IConnectMessage) => (
  isConnecting ?
    'Connecting' :
    !connectMessage ?
      'Disconnected' :
      (connectMessage.error && connectMessage.errorMessage) ?
        connectMessage.errorMessage :
        `Connected to ${connectMessage.dApp.name} (${connectMessage.dApp.address} at: ${connectMessage.dApp.url})`
)