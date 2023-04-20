const injectScript = (scriptContent: string) => {
  const script = document.createElement('script');
  script.textContent = scriptContent;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
};
const injectScriptFile = (filename: string) => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(filename);
  (document.head || document.documentElement).appendChild(script);
  script.addEventListener('load', () => {
    // Dispatch a custom event with the base URL as a detail
    // this is mostly used so we can load images from the injected content, like the logo for Sorbet
    const ebuEvent = new CustomEvent('__sorbet_extensionBaseURL', { detail: extensionBaseURL });
    window.dispatchEvent(ebuEvent);

    script.remove();
  });
};

const extensionBaseURL = chrome.runtime.getURL('');

injectScriptFile('js/injectedScript.js');