import {
  createSerialQueue,
  onStorageChanged,
  storageGet,
  storageRemove,
  storageSet,
} from "../utils/storage";

/**
 * CIP-45 peer seeds by peer id (null until the peer has a seed). Seeds identify this
 * device's peer sessions, so they live in storage.local and are never synced.
 */
export type P2PSeedMap = { [peerId: string]: string | null };

const P2P_SEEDS_KEY = "p2p_seeds";
const P2P_IS_CONNECTED_KEY = "p2p_isConnected";

function parseSeedMap(value: unknown): P2PSeedMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const seeds: P2PSeedMap = {};
  for (const [peerId, seed] of Object.entries(value)) {
    if (seed === null || typeof seed === "string") seeds[peerId] = seed;
  }
  return seeds;
}

/** Load seeds from storage.local, moving any copy older versions left in storage.sync. */
export async function loadP2PSeeds(): Promise<P2PSeedMap> {
  const local = await storageGet("local", [P2P_SEEDS_KEY]);
  if (P2P_SEEDS_KEY in local) return parseSeedMap(local[P2P_SEEDS_KEY]);
  const synced = await storageGet("sync", [P2P_SEEDS_KEY, P2P_IS_CONNECTED_KEY]);
  const seeds = parseSeedMap(synced[P2P_SEEDS_KEY]);
  if (Object.keys(synced).length > 0) {
    await storageSet("local", { [P2P_SEEDS_KEY]: seeds });
    await storageRemove("sync", [P2P_SEEDS_KEY, P2P_IS_CONNECTED_KEY]);
  }
  return seeds;
}

const enqueueSeedUpdate = createSerialQueue();

/**
 * Read-modify-write the stored seed map, serialized within this context, so per-peer
 * updates merge instead of overwriting each other. Resolves the stored map.
 */
export function updateP2PSeeds(update: (seeds: P2PSeedMap) => P2PSeedMap): Promise<P2PSeedMap> {
  return enqueueSeedUpdate(async () => {
    const next = update(await loadP2PSeeds());
    await storageSet("local", { [P2P_SEEDS_KEY]: next });
    return next;
  });
}

export function saveP2PIsConnected(connected: boolean): Promise<void> {
  return storageSet("local", { [P2P_IS_CONNECTED_KEY]: connected });
}

export async function loadP2PIsConnected(): Promise<boolean> {
  const items = await storageGet("local", [P2P_IS_CONNECTED_KEY]);
  return items[P2P_IS_CONNECTED_KEY] === true;
}

/** Subscribe to the "any P2P peer connected" flag. Returns the unsubscribe function. */
export function onP2PIsConnectedChanged(listener: (connected: boolean) => void): () => void {
  return onStorageChanged("local", [P2P_IS_CONNECTED_KEY], (changes) =>
    listener(changes[P2P_IS_CONNECTED_KEY].newValue === true)
  );
}
