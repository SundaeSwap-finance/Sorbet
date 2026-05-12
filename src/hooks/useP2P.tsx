import { CardanoPeerConnect } from "@fabianbormann/cardano-peer-connect";
import { IConnectMessage } from "@fabianbormann/cardano-peer-connect/dist/src/types";
import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import {
  P2PConnection,
  P2PConnectionState,
  SorbetPeerConnect,
} from "../modules/cip45-peer-connect";
import { Log } from "../utils/log_util";
import { P2PStorageKeys, getFromStorage } from "../utils/storage";

/** Exposed P2P Context State */
interface P2PState {
  p2pConnections: P2PConnectionMap;
  connectP2P: (peerId: string) => void;
  disconnectP2P: (peerId: string) => void;
  removeP2PConnection: (peerId: string) => void;
}

/** P2P Connection state structure  */
interface P2PConnectionMap {
  [peerId: string]:
    | {
        seed?: string;
        connection?: P2PConnection;
        p2pClient?: CardanoPeerConnect;
      }
    | undefined;
}

/** P2P Seed storage structure  */
interface P2PSeedMap {
  [peerId: string]: string | null;
}

/** Reducer Actions & Action Types  */
interface AnyAction<T = string, P = any> {
  type: T;
  payload: P;
}
type ActionType =
  | "parseSeeds"
  | "setConnections"
  | "handleConnectionStateChange"
  | "removeConnection";

/** Setup Context */
export const P2PContext = createContext<P2PState>({
  p2pConnections: {},
  connectP2P: (peerId: string) => {},
  disconnectP2P: (peerId: string) => {},
  removeP2PConnection: () => {},
});
export const useP2P = () => useContext(P2PContext);

/** P2P Context Provider */
export function P2PProvider(props: { children: JSX.Element | JSX.Element[] }) {
  /** Connection & dApp state reducer */
  function reducer(
    state: P2PConnectionMap,
    { type, payload }: AnyAction<ActionType>
  ): P2PConnectionMap {
    if (type === "parseSeeds") {
      const seedMap = payload as P2PSeedMap | undefined;
      return parseSeeds(state, seedMap);
    } else if (type === "setConnections") {
      const newConnections = payload;
      return { ...newConnections };
    } else if (type === "handleConnectionStateChange") {
      const { peerId, connection } = payload;
      const newConnections = { ...state };
      newConnections[peerId] = { ...newConnections[peerId], connection };
      saveP2PSeeds(newConnections);
      saveP2PIsConnected(newConnections);
      return newConnections;
    } else if (type === "removeConnection") {
      const peerId = payload.peerId;
      const newConnections = { ...state };
      delete newConnections[peerId];
      saveP2PSeeds(newConnections);
      return newConnections;
    }
    throw Error("Unknown action in useP2P reducer.");
  }
  const [state, dispatch] = useReducer(reducer, {});

  async function loadSeeds() {
    const seeds = await getSeedsFromStorage();
    dispatch({ type: "parseSeeds", payload: seeds });
  }
  useEffect(() => {
    if (Object.keys(state).length === 0) loadSeeds();
  }, []);

  /** Storage Util */
  const getSeedsFromStorage = async () =>
    (await getFromStorage([P2PStorageKeys.P2P_SEEDS]))[P2PStorageKeys.P2P_SEEDS] as P2PSeedMap;

  function saveP2PSeeds(state: P2PConnectionMap) {
    const newSeeds = Object.entries(state).reduce((acc, [peerId, c]) => {
      acc[peerId] = c?.seed === undefined ? null : c.seed;
      return acc;
    }, {} as P2PSeedMap);
    chrome.storage.sync.set({ [P2PStorageKeys.P2P_SEEDS]: newSeeds });
  }
  function saveP2PIsConnected(p2pConnections: P2PConnectionMap) {
    const isConnected =
      Object.values(p2pConnections).filter((c) => c?.connection?.connected).length > 0;
    chrome.storage.sync.set({ [P2PStorageKeys.P2P_IS_CONNECTED]: isConnected });
  }

  /** handle p2p connect state changes */
  function handleConnectionStateChange(
    p2pClient: CardanoPeerConnect | undefined,
    _connectionState: P2PConnectionState,
    connectMessage: IConnectMessage
  ) {
    const connection = connectMessage as P2PConnection;
    const peerId = connection.dApp.address;
    connection.dApp.identicon = p2pClient?.getIdenticon() ?? null;
    if (!peerId) return;
    dispatch({ type: "handleConnectionStateChange", payload: { peerId, connection } });
  }

  /** parse seeds from storage */
  function parseSeeds(state: P2PConnectionMap, seedMap?: P2PSeedMap): P2PConnectionMap {
    const newConnections = { ...state };
    Object.entries(seedMap ?? {}).forEach(([peerId, seed]) => {
      const existingConnection = newConnections[peerId];
      if (existingConnection) {
        newConnections[peerId] = { ...existingConnection, seed: seed ?? undefined };
      } else {
        newConnections[peerId] = {
          seed: seed ?? undefined,
          p2pClient: SorbetPeerConnect.initP2PClient(
            handleConnectionStateChange,
            seed ?? undefined
          ),
          connection: {
            connected: false,
            error: false,
            dApp: {
              address: peerId,
              name: "",
              url: "",
              identicon: null,
            },
          },
        };
      }
    });
    return newConnections;
  }

  /** Peer Connect controls: connect / disconnect / remove */
  function connectP2P(peerId: string) {
    const allConnections = state;
    let existingConnection = allConnections[peerId] ?? {};
    let p2pClient = existingConnection.p2pClient;
    if (!p2pClient) {
      const seed = existingConnection.seed;
      p2pClient = SorbetPeerConnect.initP2PClient(handleConnectionStateChange, seed ?? undefined);
      existingConnection = { ...existingConnection, p2pClient };
    }
    if (p2pClient && peerId && peerId !== "") {
      const seed = p2pClient.connect(peerId);
      const newConnections = { ...allConnections, [peerId]: { ...existingConnection, seed } };
      dispatch({ type: "setConnections", payload: newConnections });
      Log.I("useP2P: connect p2p called", { peerId, seed, newConnections });
    } else {
      Log.W("useP2P: connectP2P called without neccessary args", { peerId, p2pClient });
    }
    return { p2pClient };
  }

  function disconnectP2P(peerId: string) {
    const allConnections = state;
    const existingConnection = allConnections[peerId];
    const p2pClient = existingConnection?.p2pClient;
    Log.I("useP2P: disconnecting p2p with peerId:", peerId, {
      allConnections,
      existingConnection,
      p2pClient,
    });
    if (p2pClient && peerId && peerId !== "") {
      try {
        p2pClient?.disconnect(peerId);
      } catch (e) {
        Log.E("Error while disconnecting from p2p peer connect client", e);
      }
      if (existingConnection?.connection) {
        const newConnections = {
          ...allConnections,
          [peerId]: {
            ...existingConnection,
            connection: { ...existingConnection.connection, connected: false },
          },
        };
        dispatch({ type: "setConnections", payload: newConnections });
      }
    } else {
      Log.W("useP2P: disconnectP2P called without neccessary args", { peerId, p2pClient });
    }
    return p2pClient;
  }
  useEffect(() => {
    /** Setup Exit Listeners to Disconnect */
    const disconnectHandler = (event: any) => {
      Object.entries(state).forEach(([peerId, c]) => c?.p2pClient?.disconnect(peerId));
      saveP2PIsConnected({});
    };
    window.addEventListener("beforeunload", disconnectHandler);
    return () => {
      window.removeEventListener("beforeunload", disconnectHandler);
    };
  }, []);

  function removeP2PConnection(peerId: string) {
    dispatch({ type: "removeConnection", payload: { peerId } });
  }

  const context = useMemo(
    () => ({
      connectP2P,
      disconnectP2P,
      p2pConnections: state,
      removeP2PConnection,
    }),
    [connectP2P, disconnectP2P, state, removeP2PConnection]
  );
  return <P2PContext.Provider value={context}>{props.children}</P2PContext.Provider>;
}
