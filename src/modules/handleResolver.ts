const BLOCKFROST_MAINNET_URL = "https://cardano-mainnet.blockfrost.io";
const ADA_HANDLE_POLICY_ID = "f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a";

export class HandleResolutionError extends Error {}

const toHex = (text: string): string => Buffer.from(text, "utf8").toString("hex");

/** Extract the single holder address from a Blockfrost `/assets/{asset}/addresses` body. */
function parseHandleHolders(body: unknown, handle: string): string {
  if (!Array.isArray(body) || body.length === 0) {
    throw new HandleResolutionError(`$${handle} is not minted`);
  }
  if (body.length > 1) {
    throw new HandleResolutionError(`$${handle} resolves to multiple addresses`);
  }
  const holder: unknown = body[0];
  const address =
    typeof holder === "object" && holder !== null && "address" in holder ? holder.address : undefined;
  if (typeof address !== "string" || address === "") {
    throw new HandleResolutionError(`Unexpected Blockfrost response for $${handle}`);
  }
  return address;
}

/** Resolve an ADA Handle (without the `$`) to its current address. Throws HandleResolutionError on any failure. */
export async function resolveHandle(
  handle: string,
  mainnetApiKey: string,
  fetchFn: typeof fetch = fetch
): Promise<string> {
  if (handle === "") throw new HandleResolutionError("Empty handle");
  if (mainnetApiKey === "") throw new HandleResolutionError("Set a Blockfrost mainnet API key in Settings to resolve handles");
  const url = new URL(
    `/api/v0/assets/${ADA_HANDLE_POLICY_ID}${toHex(handle)}/addresses`,
    BLOCKFROST_MAINNET_URL
  );
  let res: Response;
  try {
    res = await fetchFn(url, { method: "GET", headers: { project_id: mainnetApiKey } });
  } catch (error) {
    throw new HandleResolutionError(`Handle lookup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!res.ok) throw new HandleResolutionError(`Handle lookup failed (HTTP ${res.status})`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new HandleResolutionError(`Unexpected Blockfrost response for $${handle}`);
  }
  return parseHandleHolders(body, handle);
}
