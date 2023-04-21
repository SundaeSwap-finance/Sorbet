export function sendMessageToBackground(payload: any): Promise<any> {
  const id = Math.random().toString(36).substr(2, 9);
  payload.id = id;
  return new Promise((resolve) => {
    const msgListener = (evt: any) => {
      if (evt.source !== window || evt.data?.type !== "FROM_CONTENT_SCRIPT") return;
      if (evt.data?.payload?.id !== id) return;

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
