import { BackgroundAction, callBackground } from "../protocol";
import { injectedTransport } from "../utils/sendMessageToBackground";

/**
 * Expose wallet address setter to the page. Waits for the user's approval unless the site was
 * allowed always; rejects when refused or when the background rejects (e.g. invalid address).
 */
export const setAddress = async function (address: string): Promise<void> {
  await callBackground(injectedTransport, BackgroundAction.SET_ADDRESS, { address });
};
/** Expose add-to-address-book to the page. Same approval rules as `setAddress`. */
export const addToAddressBook = async function (address: string): Promise<void> {
  await callBackground(injectedTransport, BackgroundAction.ADD_TO_ADDRESS_BOOK, { address });
};
