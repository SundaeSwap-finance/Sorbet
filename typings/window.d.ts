declare global {
  interface Window {
    __sorbet_ExtensionBaseUrl: string;
    /** Installed by the stub: hand over the real wallet functions and icon. */
    __sorbet_patch_api: (
      enable: () => Promise<unknown>,
      isEnabled: () => Promise<boolean>,
      icon?: string
    ) => void;
    /** Installed by the stub: report that no wallet will be available (enable() rejects with an APIError). */
    __sorbet_fail: (info: string) => void;
    cardano: any;
  }
}

export {};
