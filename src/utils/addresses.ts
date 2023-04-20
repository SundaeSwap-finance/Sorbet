import { bech32 } from "bech32";

export const getNetworkPrefix = (address: string) => {
  const serializedAddress = bech32.decode(address, 999);
  const network = serializedAddress.prefix === "addr_test" ? 0 : 1;
  const networkPrefix = network ? "e1" : "e0";
  return networkPrefix;
};

export const stakeKeyFromAddress = (address: string) =>
  bech32.encode(
    "stake",
    bech32.toWords(
      Buffer.from(
        `${getNetworkPrefix(address)}${addressToCredentials(address)?.stakingKeyHash}`,
        "hex"
      )
    ),
    999
  );

export const bech32ToHex = (addr: string) => {
  const serializedAddress = bech32.decode(addr, 999);
  return Buffer.from(bech32.fromWords(serializedAddress.words)).toString("hex");
};

export const addressToCredentials = (address: string) => {
  const serializedAddress = bech32.decode(address, 999);
  const hexAddress = Buffer.from(bech32.fromWords(serializedAddress.words)).toString("hex");

  const stakingKeyHash = hexAddress?.slice(58);
  const paymentKeyHash = hexAddress?.slice(0, 58);

  return {
    paymentKeyHash,
    stakingKeyHash,
  };
};
