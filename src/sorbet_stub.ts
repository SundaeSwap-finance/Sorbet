/**
 * Sorbet Stub — injected synchronously at document_start in the MAIN world.
 * Registers window.cardano.sorbet immediately so dApps discover it before
 * any of their own JS runs. The real implementation (injectedScript.js)
 * patches in the actual enable()/isEnabled() later and resolves the
 * _readyPromise so any early enable() callers get unblocked.
 */
(function () {
  if (typeof window.cardano === "undefined") {
    window.cardano = {} as any;
  }

  // Promise that resolves once the full implementation is wired up.
  let _resolveReady: () => void;
  const _readyPromise = new Promise<void>((resolve) => {
    _resolveReady = resolve;
  });

  // Expose the resolver so the full script can signal readiness.
  (window as any).__sorbet_resolve_ready = () => _resolveReady();

  // Real enable/isEnabled will be patched in by injectedScript.
  let _realEnable: (() => Promise<any>) | null = null;
  let _realIsEnabled: (() => Promise<boolean>) | null = null;

  // Allow the full script to patch enable/isEnabled after loading.
  (window as any).__sorbet_patch_api = (
    enable: () => Promise<any>,
    isEnabled: () => Promise<boolean>
  ) => {
    _realEnable = enable;
    _realIsEnabled = isEnabled;
  };

  window.cardano.sorbet = {
    apiVersion: "0.1.0",
    name: "Sorbet",
    // Placeholder icon — patched with the real extension URL once available.
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
    enable: async function () {
      await _readyPromise;
      return _realEnable!();
    },
    isEnabled: async function () {
      if (!_realIsEnabled) return false;
      return _realIsEnabled();
    },
  };
})();
