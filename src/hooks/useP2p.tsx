import { CardanoPeerConnect } from "@fabianbormann/cardano-peer-connect";
import { IConnectMessage, IDAppInfos } from "@fabianbormann/cardano-peer-connect/dist/src/types";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initP2PClient } from "../modules/cip45-peer-connect";
import { Log } from "../utils/log_util";
import { P2PStorageKeys, makeStorageChangeListener } from "../utils/storage";

interface P2PState extends P2PConnectionsState {
  isReady: boolean,
  p2pClient: CardanoPeerConnect | undefined,
  connectP2P: () => void,
  disconnectP2P: () => void,
  peerId: string | undefined,
  savePeerId: (peerId: string) => void,
  identicon?: React.MutableRefObject<string | null>,
  p2pSeed: string | undefined,

  isConnecting: boolean,
  isConnected: boolean,
  connectionState: ConnectionState,
  connectMessage: IConnectMessage | undefined,
}

export interface P2PConnection extends IDAppInfos {
  identicon: React.MutableRefObject<string | null>,
}
export interface P2PConnectionsState {
  p2pConnections: P2PConnection[], setP2pConnections: (c: P2PConnection[]) => void,
  addP2pConnection: (c: P2PConnection) => void, removeP2pConnection: (peerId: string) => void
}


type ConnectionState = 'disconnected' | 'connected' | 'connecting'

export const P2PContext = createContext<P2PState>({
  isReady: false,
  connectionState: 'disconnected', connectMessage: undefined, isConnected: false, isConnecting: false,
  p2pClient: undefined, p2pSeed: undefined, peerId: undefined,
  connectP2P: () => { }, disconnectP2P: () => { }, savePeerId: () => { },
  p2pConnections: [],
  setP2pConnections: () => { }, addP2pConnection: () => { }, removeP2pConnection: () => { },
});

/** Hooks for using P2PContext at various granularity levels */
export const useP2p = () => useContext(P2PContext)
export const useP2pStatus = () => {
  const { isConnected, isConnecting, connectMessage, connectionState } = useContext(P2PContext)
  return { isConnected, isConnecting, connectMessage, connectionState }
}
/** Component providing P2PContext */
export function P2PProvider(props: { children: JSX.Element | JSX.Element[] }) {
  /** Retrieve P2P values from storage and update state  */
  useEffect(() => {
    const listeners = [
      makeStorageChangeListener(P2PStorageKeys.P2P_PEER_ID, _setPeerId, true, ""),
      makeStorageChangeListener(P2PStorageKeys.P2P_SEED, _setP2pSeed, true)
    ]
    return () => { listeners.forEach(lstnr => lstnr()) }
  }, [])
  const [peerId, _setPeerId] = useState<string>()
  const savePeerId = (peerId?: string) => {
    chrome.storage.sync.set({ [P2PStorageKeys.P2P_PEER_ID]: peerId });
  }
  const [p2pSeed, _setP2pSeed] = useState<string>()
  const saveP2pSeed = (p2pSeed?: string) => {
    chrome.storage.sync.set({ [P2PStorageKeys.P2P_SEED]: p2pSeed }
    );
  }
  /** Connection State Helpers  */
  const [connectMessage, setConnectedMessage] = useState<IConnectMessage>()
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [isConnected, setIsConnected] = useState(connectionState === "connected")
  const [isConnecting, setIsConnecting] = useState(connectionState === "connecting")
  useEffect(() => {
    setIsConnected(connectionState === "connected")
    setIsConnecting(connectionState === "connecting")
  }, [connectionState])

  /** P2P Client */
  const [p2pClient, _setP2pClient] = useState<CardanoPeerConnect | undefined>(() => {
    /** Setup Exit Listeners to Disconnect */
    window.addEventListener('beforeunload', (event: any) => {
      p2pClient?.disconnect(peerId!);
    })
    const _setConnectionState = (state: ConnectionState, m: IConnectMessage) => {
      setConnectionState(state)
      setConnectedMessage(m)
      if (p2pClient) {
        identicon.current = p2pClient.getIdenticon()
      }
      addP2pConnection({
        ...m.dApp, identicon
      })
      // savePeerId(undefined)
      // _setPeerId(undefined)
    }
    return initP2PConnectClient(_setConnectionState, p2pSeed)
  })

  const identicon = useRef<string | null>(null);

  // handle connect / disconnect 
  const connectP2P = () => {
    if (p2pClient && peerId && peerId !== "") {
      setConnectionState('connecting')
      const seed = p2pClient.connect(peerId)
      saveP2pSeed(seed)
    } else {
      setConnectionState('disconnected')
    }
  }
  const disconnectP2P = () => {
    try {
      p2pClient?.disconnect(peerId!)
    } catch (e) {
      Log.E("Error while disconnecting from p2p peer connect client", e)
    }
    clearConnectionState()
  }
  const clearConnectionState = () => {
    saveP2pSeed(undefined)
    identicon.current = null
    setConnectedMessage(undefined)
    setConnectionState('disconnected')
    Log.D("after clearConnectionState")
  }

  const [p2pConnections, setP2pConnections] = useState<P2PConnection[]>([])
  const addP2pConnection = (c: P2PConnection) => setP2pConnections([...p2pConnections, c])
  const removeP2pConnection = (peerId: string) => { setP2pConnections([...p2pConnections.filter(c => c.address !== peerId)]) }

  const context = useMemo(() => ({
    p2pClient, connectP2P, disconnectP2P,
    peerId, savePeerId,
    connectMessage, identicon, p2pSeed,
    isConnected, isConnecting, connectionState,
    p2pConnections, setP2pConnections, addP2pConnection, removeP2pConnection,
    isReady: true
  }), [
    p2pClient, connectP2P, disconnectP2P,
    peerId, savePeerId,
    connectMessage, identicon, p2pSeed,
    isConnected, isConnecting, connectionState,
    p2pConnections, setP2pConnections, addP2pConnection, removeP2pConnection
  ])
  // Log.D("useP2p context:", context)
  return <P2PContext.Provider value={context}>{props.children}</P2PContext.Provider>
}

const initP2PConnectClient = (
  setConnectionState: (state: ConnectionState, m: IConnectMessage) => void,
  p2pSeed?: string
) => {

  // if (hasP2PClient()) {
  //   return initP2PClient(p2pSeed)
  // }

  const p2pClient = initP2PClient(p2pSeed)

  const logMessage = (func: string, connectMessage: IConnectMessage) =>
    Log.App.P2PConnect(`${func} hook called with message:`, connectMessage)

  /** Setup connection status listeners */
  p2pClient.setOnConnect((connectMessage: IConnectMessage) => {
    logMessage("OnConnect", connectMessage)
    setConnectionState('connected', connectMessage)
  });

  p2pClient.setOnDisconnect((connectMessage: IConnectMessage) => {
    logMessage("OnDisconnect", connectMessage)
    setConnectionState('disconnected', connectMessage)
  });

  p2pClient.setOnServerShutdown((connectMessage: IConnectMessage) => {
    logMessage("ServerShutdown", connectMessage)
    setConnectionState('disconnected', connectMessage)
  });

  p2pClient.setOnApiInject((connectMessage: IConnectMessage) => {
    logMessage("ApiInject", connectMessage)
  });
  return p2pClient
}