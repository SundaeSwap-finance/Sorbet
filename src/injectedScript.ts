let sorbetExtensionBaseURL;
window.addEventListener('__sorbet_extensionBaseURL', (event: CustomEventInit) => {
  sorbetExtensionBaseURL = event.detail;

  // Check if the window.cardano object exists or create it
  if (typeof window.cardano === 'undefined') {
    window.cardano = {};
  }

  // Check if the window.cardano.sorbet object exists or create it
  if (typeof window.cardano.sorbet === 'undefined') {
    window.cardano.sorbet = {
      apiVersion: "0.1.0",
      icon: `${sorbetExtensionBaseURL}sorbet.png`,
      name: "Sorbet",
      enable: async function() {
        return window.cardano.eternl.enable();
      },
      isEnabled: async function() {
        return window.cardano.eternl.isEnabled();
      }
    };
  }

  console.log("Sorbet injected.");
});