declare global {
  interface Window {
    __sorbet_ExtensionBaseUrl: string;
    __sorbet_resolve_ready: () => void;
    __sorbet_patch_api: (
      enable: () => Promise<any>,
      isEnabled: () => Promise<boolean>
    ) => void;
    cardano: any;
  }
}

export {};
