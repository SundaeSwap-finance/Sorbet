let sorbetExtensionBaseURL;

function sendMessageToBackground(payload: any): Promise<any> {
  return new Promise((resolve) => {
    const msgListener = (evt: any) => {
      if (evt.source !== window || evt.data?.type !== 'FROM_CONTENT_SCRIPT') return;

      // Remove the event listener after receiving the response
      window.removeEventListener('message', msgListener);

      // Resolve the promise with the response payload
      resolve(evt.data.payload);
    }
     // Add the event listener to listen for the response
    window.addEventListener('message', msgListener);

    // Send the message to the content script
    window.postMessage({ type: 'FROM_INJECTED_SCRIPT', payload }, window.origin);
  })
}

window.addEventListener('__sorbet_extensionBaseURL', async (event: CustomEventInit) => {
  sorbetExtensionBaseURL = event.detail;

  // Check if the window.cardano object exists or create it
  if (typeof window.cardano === 'undefined') {
    window.cardano = {};
  }

  // Check if the window.cardano.sorbet object exists or create it
  if (typeof window.cardano.sorbet === 'undefined') {
    let isWrapped = await sendMessageToBackground({ action: 'query_isWrapped' });
    if (isWrapped.result) {

      window.cardano.sorbet = {
        apiVersion: "0.1.0",
        icon: `${sorbetExtensionBaseURL}sorbet.png`,
        name: "Sorbet",
        enable: async function() {
          return window.cardano[isWrapped.wrappedWallet].enable();
        },
        isEnabled: async function() {
          return window.cardano[isWrapped.wrappedWallet].isEnabled();
        }
      };
      console.log(`Sorbet: wallet injected (wrapping ${isWrapped.wrappedWallet}).`);
    }
  }

  console.log("Sorbet: done.");
});