import { BackgroundError } from "../protocol";

// CIP-30 APIError codes. InternalError signals a recoverable wallet-side problem
// (e.g. the user hasn't finished setting up the wallet) without crashing the dApp.
export const APIErrorCode = {
  InvalidRequest: -1,
  InternalError: -2,
  Refused: -3,
  AccountChange: -4,
} as const;

/** CIP-30 APIError as thrown to dApps. */
export interface APIError {
  code: number;
  info: string;
}

export function apiError(info: string, code: number = APIErrorCode.InternalError): APIError {
  return { code, info };
}

/** A background failure as an APIError: refusals are -3, everything else -2. */
export function backgroundErrorToApiError(error: BackgroundError): APIError {
  return apiError(error.message, error.refused ? APIErrorCode.Refused : APIErrorCode.InternalError);
}
