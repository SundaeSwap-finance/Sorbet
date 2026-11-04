import { bech32 } from "bech32";
import { NetworkId } from "../types";

const BECH32_LIMIT = 1023;
const CREDENTIAL_BYTES = 28;
/** Header byte + payment credential + stake credential. */
const BASE_ADDRESS_BYTES = 1 + 2 * CREDENTIAL_BYTES;
/** Header byte + payment credential. */
const ENTERPRISE_ADDRESS_BYTES = 1 + CREDENTIAL_BYTES;

interface ShelleyAddress {
  /** CIP-19 address type: the header byte's high nibble, 0-7 for Shelley payment addresses. */
  type: number;
  network: NetworkId;
  bytes: Uint8Array;
}

/** Decode a Shelley payment address once (CIP-19); null for anything else. */
function decodeShelleyAddress(value: string): ShelleyAddress | null {
  let decoded: { prefix: string; words: number[] };
  try {
    decoded = bech32.decode(value, BECH32_LIMIT);
  } catch {
    return null;
  }
  const prefixNetwork = decoded.prefix === "addr" ? 1 : decoded.prefix === "addr_test" ? 0 : null;
  if (prefixNetwork === null) return null;

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(bech32.fromWords(decoded.words));
  } catch {
    return null;
  }
  if (bytes.length === 0) return null;

  const type = bytes[0] >> 4;
  const network = bytes[0] & 0x0f;
  if (type > 7 || network !== prefixNetwork) return null;

  const minLength = type <= 3 ? BASE_ADDRESS_BYTES : ENTERPRISE_ADDRESS_BYTES;
  if (bytes.length < minLength) return null;
  if (type <= 3 && bytes.length !== BASE_ADDRESS_BYTES) return null;
  if ((type === 6 || type === 7) && bytes.length !== ENTERPRISE_ADDRESS_BYTES) return null;
  if ((type === 4 || type === 5) && bytes.length === ENTERPRISE_ADDRESS_BYTES) return null;

  return { type, network: network as NetworkId, bytes };
}

export const isValidAddress = (value: string): boolean => decodeShelleyAddress(value) !== null;

export const networkIdFromAddress = (address: string): NetworkId | null =>
  decodeShelleyAddress(address)?.network ?? null;

/** Bech32 stake address for base addresses (types 0-3); null for every other address. */
export const stakeKeyFromAddress = (address: string): string | null => {
  const decoded = decodeShelleyAddress(address);
  if (!decoded || decoded.type > 3) return null;

  const rewardHeader = (decoded.type <= 1 ? 0xe0 : 0xf0) | decoded.network;
  const reward = new Uint8Array(1 + CREDENTIAL_BYTES);
  reward[0] = rewardHeader;
  reward.set(decoded.bytes.subarray(1 + CREDENTIAL_BYTES, BASE_ADDRESS_BYTES), 1);
  return bech32.encode(
    decoded.network === 0 ? "stake_test" : "stake",
    bech32.toWords(reward),
    BECH32_LIMIT
  );
};

export const bech32ToHex = (addr: string) => {
  const serializedAddress = bech32.decode(addr, 999);
  return Buffer.from(bech32.fromWords(serializedAddress.words)).toString("hex");
};
