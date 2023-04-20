export function sendMessageToBackground(payload: any): Promise<any> {
  return new Promise((resolve) => {
    const msgListener = (evt: any) => {
      if (evt.source !== window || evt.data?.type !== "FROM_CONTENT_SCRIPT") return;

      // Remove the event listener after receiving the response
      window.removeEventListener("message", msgListener);

      // Resolve the promise with the response payload
      resolve(evt.data.payload);
    };
    // Add the event listener to listen for the response
    window.addEventListener("message", msgListener);

    // Send the message to the content script
    window.postMessage({ type: "FROM_INJECTED_SCRIPT", payload }, window.origin);
  });
}
