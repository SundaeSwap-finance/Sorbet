import { sendMessageToBackground } from "../utils/sendMessageToBackground";

/**  expose Wallet Address setter functionality to the page. Sends a message to background. */
export const setAddress = async function (address: string): Promise<void> {
  await sendMessageToBackground({ action: "setAddress", address });
};
/**  expose Add to Address Book functionality to the page. Sends a message to background. */
export const addToAddressBook = async function (address: string): Promise<void> {
  await sendMessageToBackground({ action: "addToAddressBook", address });
};
