import type { IDAppInfos } from "@fabianbormann/cardano-peer-connect/dist/src/types";
import type { P2PConnection, P2PDapp } from "../modules/cip45-peer-connect";
import type { P2PSeedMap } from "../modules/p2pStorage";

export interface P2PEntry {
  seed?: string;
  connection: P2PConnection;
}

/** P2P connections by peer id. The state is plain data; clients live outside the reducer. */
export type P2PConnectionMap = { [peerId: string]: P2PEntry };

/** What a peer-connect state callback reports, copied out of the library's message. */
export interface ConnectionEvent {
  connected: boolean;
  error: boolean;
  errorMessage?: string;
  /** Absent when the library reports a state change without dApp details. */
  dApp?: IDAppInfos;
  identicon: string | null;
}

export type P2PAction =
  /** Stored seeds on startup: adds peers not yet known, never overrides a known peer. */
  | { type: "seed"; seeds: P2PSeedMap }
  /** connect() returned the seed of this peer's session. */
  | { type: "seeded"; peerId: string; seed: string }
  | { type: "connected"; peerId: string; event: ConnectionEvent }
  /** Without an event the existing connection details are kept and only marked offline. */
  | { type: "disconnected"; peerId: string; event?: ConnectionEvent }
  | { type: "removed"; peerId: string };

function placeholderDApp(peerId: string, identicon: string | null = null): P2PDapp {
  return { address: peerId, name: "", url: "", identicon };
}

function offlineEntry(peerId: string, seed?: string): P2PEntry {
  return {
    seed,
    connection: { connected: false, error: false, dApp: placeholderDApp(peerId) },
  };
}

function applyEvent(
  peerId: string,
  entry: P2PEntry | undefined,
  event: ConnectionEvent,
  connected: boolean
): P2PEntry {
  const previous = entry ?? offlineEntry(peerId);
  const previousDApp = previous.connection.dApp;
  const dApp: P2PDapp = {
    ...previousDApp,
    ...event.dApp,
    identicon: event.identicon ?? previousDApp.identicon,
  };
  return {
    ...previous,
    connection: { connected, error: event.error, errorMessage: event.errorMessage, dApp },
  };
}

export function p2pReducer(state: P2PConnectionMap, action: P2PAction): P2PConnectionMap {
  switch (action.type) {
    case "seed": {
      const next = { ...state };
      for (const [peerId, seed] of Object.entries(action.seeds)) {
        if (!(peerId in next)) next[peerId] = offlineEntry(peerId, seed ?? undefined);
      }
      return next;
    }
    case "seeded": {
      const entry = state[action.peerId] ?? offlineEntry(action.peerId);
      return { ...state, [action.peerId]: { ...entry, seed: action.seed } };
    }
    case "connected":
      return {
        ...state,
        [action.peerId]: applyEvent(
          action.peerId,
          state[action.peerId],
          action.event,
          action.event.connected
        ),
      };
    case "disconnected": {
      const entry = state[action.peerId];
      // A late event for a removed peer must not resurrect it.
      if (!entry) return state;
      const next = action.event
        ? applyEvent(action.peerId, entry, action.event, false)
        : { ...entry, connection: { ...entry.connection, connected: false } };
      return { ...state, [action.peerId]: next };
    }
    case "removed": {
      if (!(action.peerId in state)) return state;
      const { [action.peerId]: _removed, ...rest } = state;
      return rest;
    }
  }
}

export function hasConnectedPeer(state: P2PConnectionMap): boolean {
  return Object.values(state).some((entry) => entry.connection.connected);
}
