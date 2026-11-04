import type { ApprovalDecision, ApprovalKind } from "./protocol";
import { networkIdFromAddress } from "./utils/addresses";

const LOCAL_HOSTNAME = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/;

/** Warning to show next to a requesting origin, or null when nothing is suspicious. */
export function originWarning(origin: string): string | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return "This origin could not be parsed. Deny unless you know this site.";
  }
  if (url.protocol === "http:" && !LOCAL_HOSTNAME.test(url.hostname)) {
    return "This site is not using HTTPS. Anyone on the network could impersonate it.";
  }
  return null;
}

export interface DecisionOption {
  decision: ApprovalDecision;
  label: string;
  primary: boolean;
}

/** Buttons offered per approval kind, in display order. */
export function decisionOptions(kind: ApprovalKind): DecisionOption[] {
  if (kind === "connect") {
    return [
      { decision: "allow_always", label: "Connect", primary: true },
      { decision: "deny", label: "Cancel", primary: false },
    ];
  }
  return [
    { decision: "allow_once", label: "Allow once", primary: true },
    { decision: "allow_always", label: "Always allow this site", primary: false },
    { decision: "deny", label: "Deny", primary: false },
  ];
}

/** What the site asks for, as a sentence fragment after the origin. */
export function approvalHeadline(kind: ApprovalKind): string {
  switch (kind) {
    case "connect":
      return "wants to connect to Sorbet and read the impersonated address, balance, UTxOs and wallet logs.";
    case "setAddress":
      return "wants to change the address Sorbet impersonates to:";
    case "addToAddressBook":
      return "wants to add this address to your address book:";
  }
}

/** "Mainnet", "Testnet", or null when the network cannot be determined. */
export function addressNetworkLabel(address: string): "Mainnet" | "Testnet" | null {
  const network = networkIdFromAddress(address);
  if (network === null) return null;
  return network === 1 ? "Mainnet" : "Testnet";
}
