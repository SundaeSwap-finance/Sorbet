import { CardanoPeerConnect } from "@fabianbormann/cardano-peer-connect";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { SorbetPeerConnect } from "../modules/cip45-peer-connect";
import { loadP2PSeeds, saveP2PIsConnected, updateP2PSeeds } from "../modules/p2pStorage";
import { Log } from "../utils/log_util";
import { P2PConnectionMap, hasConnectedPeer, p2pReducer } from "./p2pConnections";

/** Exposed P2P Context State */
interface P2PState {
  p2pConnections: P2PConnectionMap;
  /** Connects to the peer and persists its seed. Rejects when connecting or persisting fails. */
  connectP2P: (peerId: string) => Promise<void>;
  disconnectP2P: (peerId: string) => void;
  removeP2PConnection: (peerId: string) => void;
}

/** Setup Context */
export const P2PContext = createContext<P2PState>({
  p2pConnections: {},
  connectP2P: () => Promise.reject(new Error("P2PProvider is missing")),
  disconnectP2P: () => {},
  removeP2PConnection: () => {},
});
export const useP2P = () => useContext(P2PContext);

function disconnectClient(client: CardanoPeerConnect, peerId: string) {
  try {
    client.disconnect(peerId);
  } catch (e) {
    Log.E("useP2P: error while disconnecting from p2p peer", peerId, e);
  }
}

/** P2P Context Provider */
export function P2PProvider(props: { children: JSX.Element | JSX.Element[] }) {
  const [state, dispatch] = useReducer(p2pReducer, {});
  /** The live clients by peer id; the reducer only ever sees plain data. */
  const clients = useRef(new Map<string, CardanoPeerConnect>());

  /** Returns the client for this peer, creating it (bound to this peerId) when missing. */
  const ensureClient = useCallback((peerId: string, seed?: string) => {
    const existing = clients.current.get(peerId);
    if (existing) return existing;
    const client = SorbetPeerConnect.initP2PClient((_client, connectionState, message) => {
      // Events of a client that was removed (or replaced) must not touch the state.
      if (clients.current.get(peerId) !== client) return;
      const event = {
        connected: message.connected,
        error: message.error,
        errorMessage: message.errorMessage,
        dApp: message.dApp,
        identicon: client.getIdenticon(),
      };
      dispatch(
        connectionState === "connected"
          ? { type: "connected", peerId, event }
          : { type: "disconnected", peerId, event }
      );
    }, seed);
    clients.current.set(peerId, client);
    return client;
  }, []);

  /** Restore the peers (and their clients) known from earlier sessions. */
  useEffect(() => {
    let cancelled = false;
    loadP2PSeeds()
      .then((seeds) => {
        if (cancelled) return;
        for (const [peerId, seed] of Object.entries(seeds)) ensureClient(peerId, seed ?? undefined);
        dispatch({ type: "seed", seeds });
      })
      .catch((e) => Log.E("useP2P: failed to load stored seeds", e));
    return () => {
      cancelled = true;
    };
  }, [ensureClient]);

  /** Publish whether any peer is connected, only when that changes. */
  const anyConnected = hasConnectedPeer(state);
  const publishedConnected = useRef<boolean>();
  useEffect(() => {
    if (publishedConnected.current === anyConnected) return;
    publishedConnected.current = anyConnected;
    saveP2PIsConnected(anyConnected).catch((e) =>
      Log.E("useP2P: failed to store the connected flag", e)
    );
  }, [anyConnected]);

  /** Disconnect every live client when the window closes. */
  useEffect(() => {
    const disconnectAll = () => {
      clients.current.forEach((client, peerId) => disconnectClient(client, peerId));
      saveP2PIsConnected(false).catch((e) => Log.E("useP2P: failed to clear connected flag", e));
    };
    window.addEventListener("beforeunload", disconnectAll);
    return () => window.removeEventListener("beforeunload", disconnectAll);
  }, []);

  const connectP2P = useCallback(
    async (peerId: string) => {
      if (peerId === "") throw new Error("A peer id is required to connect");
      const isNew = !clients.current.has(peerId);
      const client = ensureClient(peerId);
      let seed: string;
      try {
        seed = client.connect(peerId);
      } catch (e) {
        if (isNew) clients.current.delete(peerId);
        throw e;
      }
      dispatch({ type: "seeded", peerId, seed });
      Log.I("useP2P: connect p2p called", { peerId });
      await updateP2PSeeds((seeds) => ({ ...seeds, [peerId]: seed }));
    },
    [ensureClient]
  );

  const disconnectP2P = useCallback((peerId: string) => {
    const client = clients.current.get(peerId);
    if (!client) {
      Log.W("useP2P: disconnectP2P called for an unknown peer", { peerId });
      return;
    }
    disconnectClient(client, peerId);
    dispatch({ type: "disconnected", peerId });
  }, []);

  const removeP2PConnection = useCallback((peerId: string) => {
    const client = clients.current.get(peerId);
    if (client) {
      disconnectClient(client, peerId);
      clients.current.delete(peerId);
    }
    dispatch({ type: "removed", peerId });
    updateP2PSeeds(({ [peerId]: _removed, ...rest }) => rest).catch((e) =>
      Log.E("useP2P: failed to remove the stored seed", peerId, e)
    );
  }, []);

  const context = useMemo(
    () => ({ connectP2P, disconnectP2P, p2pConnections: state, removeP2PConnection }),
    [connectP2P, disconnectP2P, state, removeP2PConnection]
  );
  return <P2PContext.Provider value={context}>{props.children}</P2PContext.Provider>;
}
