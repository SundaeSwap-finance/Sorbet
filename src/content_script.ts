const injectScript = (scriptContent: string) => {
  const script = document.createElement("script");
  script.textContent = scriptContent;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
};
const injectScriptFile = (filename: string) => {
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = chrome.runtime.getURL(filename);
  (document.head || document.documentElement).appendChild(script);
  script.addEventListener("error", (e) => {
    console.log(e);
  });
  script.addEventListener("load", () => {
    // Dispatch a custom event with the base URL as a detail
    // this is mostly used so we can load images from the injected content, like the logo for Sorbet
    const extensionBaseURL = chrome.runtime.getURL("");
    const ebuEvent = new CustomEvent("__sorbet_extensionBaseURL", {
      detail: { extensionBaseURL },
    });
    window.dispatchEvent(ebuEvent);
    script.remove();
  });
};

// Listen for messages from the injected script
window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.type !== "FROM_INJECTED_SCRIPT") {
    return;
  }

  chrome.runtime.sendMessage(event.data.payload, (response) => {
    window.postMessage({ type: "FROM_CONTENT_SCRIPT", payload: response }, window.origin);
  });
});

injectScriptFile("js/injectedScript.js");
