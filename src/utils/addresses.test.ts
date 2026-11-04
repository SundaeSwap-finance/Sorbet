import { bech32 } from "bech32";
import { isValidAddress, networkIdFromAddress, stakeKeyFromAddress } from "./addresses";

// CIP-19 test vectors
const BASE_KEY_KEY =
  "addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x";
const BASE_SCRIPT_PAYMENT =
  "addr1z8phkx6acpnf78fuvxn0mkew3l0fd058hzquvz7w36x4gten0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs9yc0hh";
const BASE_TESTNET =
  "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs68faae";
const ENTERPRISE = "addr1vx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzers66hrl8";
const STAKE = "stake1uyehkck0lajq8gr28t9uxnuvgcqrc6070x3k9r8048z8y5gh6ffgw";

describe("stakeKeyFromAddress", () => {
  it("derives the stake address for key and script stake credentials", () => {
    expect(stakeKeyFromAddress(BASE_KEY_KEY)).toBe(STAKE);
    // type 1: script payment credential, key stake credential
    expect(stakeKeyFromAddress(BASE_SCRIPT_PAYMENT)).toBe(STAKE);
    // type 3: script stake credential -> 0xf1 reward header
    const bytes = Buffer.from(bech32.fromWords(bech32.decode(BASE_KEY_KEY, 999).words));
    bytes[0] = 0x31;
    const scriptStake = bech32.encode("addr", bech32.toWords(bytes), 999);
    const reward = Buffer.from(bech32.fromWords(bech32.decode(stakeKeyFromAddress(scriptStake)!, 999).words));
    expect(reward[0]).toBe(0xf1);
    expect(reward.subarray(1)).toEqual(bytes.subarray(29));
    expect(stakeKeyFromAddress(BASE_TESTNET)).toBe(
      "stake_test1uqehkck0lajq8gr28t9uxnuvgcqrc6070x3k9r8048z8y5gssrtvn"
    );
  });

  it("is null for enterprise and invalid addresses", () => {
    expect(stakeKeyFromAddress(ENTERPRISE)).toBeNull();
    expect(stakeKeyFromAddress("not an address")).toBeNull();
  });
});

describe("isValidAddress / networkIdFromAddress", () => {
  it("accepts Shelley payment addresses and reports their network", () => {
    for (const a of [BASE_KEY_KEY, BASE_SCRIPT_PAYMENT, ENTERPRISE, BASE_TESTNET]) {
      expect(isValidAddress(a)).toBe(true);
    }
    expect(networkIdFromAddress(BASE_KEY_KEY)).toBe(1);
    expect(networkIdFromAddress(BASE_TESTNET)).toBe(0);
    expect(networkIdFromAddress(STAKE)).toBeNull();
  });

  it("rejects stake addresses, arbitrary bech32 and a prefix/network mismatch", () => {
    expect(isValidAddress(STAKE)).toBe(false);
    expect(isValidAddress(bech32.encode("foo", bech32.toWords(Buffer.from("hello world")), 200))).toBe(false);
    const bytes = Buffer.from(bech32.fromWords(bech32.decode(ENTERPRISE, 999).words));
    expect(isValidAddress(bech32.encode("addr_test", bech32.toWords(bytes), 999))).toBe(false);
    expect(isValidAddress("")).toBe(false);
  });
});
