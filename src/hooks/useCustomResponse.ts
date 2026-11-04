import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSettings, onSettingsChanged, saveSettings } from "../settings";
import { UTxO } from "../types";
import { createSerialQueue } from "../utils/storage";

const CUSTOM_RESPONSE_KEYS = ["customResponseEnabled", "mockUtxos"] as const;

/** A UTxO with a React key that stays stable while the row is edited, moved or removed around. */
export interface UtxoRow {
  key: number;
  utxo: UTxO;
}

const NEW_UTXO: UTxO = {
  amount: [{ quantity: "0", unit: "lovelace" }],
  address: "",
  output_index: 0,
  tx_hash: "",
};

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Coalesce keystrokes into one chrome.storage.sync write (sync allows ~120 writes per minute). */
const SAVE_DEBOUNCE_MS = 400;

export function useCustomResponse() {
  const [rows, setRows] = useState<UtxoRow[]>([]);
  const [isCustomResponseEnabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronously up-to-date copy of `rows`, so quick consecutive edits compose.
  const rowsRef = useRef<UtxoRow[]>([]);
  const nextKey = useRef(0);
  const enqueue = useRef(createSerialQueue()).current;
  // Local edits are the source of truth until persisted: storage echoes of our own older
  // writes must never overwrite newer keystrokes.
  const saveTimer = useRef<number | undefined>(undefined);
  const savesInFlight = useRef(0);

  const adopt = useCallback((next: UtxoRow[]) => {
    rowsRef.current = next;
    setRows(next);
  }, []);

  /** Replace rows with stored UTxOs unless they already match (keeps keys, focus and drafts). */
  const adoptStored = useCallback(
    (stored: UTxO[]) => {
      if (JSON.stringify(stored) === JSON.stringify(rowsRef.current.map((r) => r.utxo))) return;
      adopt(stored.map((utxo) => ({ key: nextKey.current++, utxo })));
    },
    [adopt]
  );

  /** Write the latest rows now (serialized; the latest state wins). */
  const persist = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    const snapshot = rowsRef.current.map((r) => r.utxo);
    savesInFlight.current++;
    enqueue(() => saveSettings({ mockUtxos: snapshot }))
      .catch(async (e) => {
        setError(`Could not save UTxOs: ${errorMessage(e)}`);
        if (saveTimer.current !== undefined) return; // newer edits are about to be saved
        try {
          adoptStored((await loadSettings(["mockUtxos"])).mockUtxos);
        } catch {
          // The save error above already tells the user the stored state is unknown.
        }
      })
      .finally(() => {
        savesInFlight.current--;
      });
  }, [adoptStored, enqueue]);

  useEffect(() => {
    let active = true;
    loadSettings(CUSTOM_RESPONSE_KEYS)
      .then(({ customResponseEnabled, mockUtxos }) => {
        if (!active) return;
        setEnabled(customResponseEnabled);
        adoptStored(mockUtxos);
      })
      .catch((e) => active && setError(`Could not load custom response: ${errorMessage(e)}`));
    const unsubscribe = onSettingsChanged(CUSTOM_RESPONSE_KEYS, ({ customResponseEnabled, mockUtxos }) => {
      setEnabled(customResponseEnabled);
      // Only external changes apply; while edits are pending or saving, storage lags behind them.
      if (saveTimer.current === undefined && savesInFlight.current === 0) adoptStored(mockUtxos);
    });
    // Persist pending edits before the popup goes away.
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden" && saveTimer.current !== undefined) persist();
    };
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", flushWhenHidden);
      if (saveTimer.current !== undefined) persist();
    };
  }, [adoptStored, persist]);

  /** Apply `update` to the latest rows now; persist after typing pauses. */
  const updateRows = useCallback(
    (update: (current: UtxoRow[]) => UtxoRow[]) => {
      adopt(update(rowsRef.current));
      setError(null);
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(persist, SAVE_DEBOUNCE_MS);
    },
    [adopt, persist]
  );

  const setIsCustomResponseEnabled = useCallback((enabled: boolean) => {
    setEnabled(enabled);
    setError(null);
    saveSettings({ customResponseEnabled: enabled }).catch((e) => {
      setEnabled(!enabled);
      setError(`Could not save setting: ${errorMessage(e)}`);
    });
  }, []);

  const addU = useCallback(
    () => updateRows((current) => [...current, { key: nextKey.current++, utxo: NEW_UTXO }]),
    [updateRows]
  );
  const removeUi = useCallback(
    (key: number) => updateRows((current) => current.filter((row) => row.key !== key)),
    [updateRows]
  );
  const setUi = useCallback(
    (key: number, utxo: UTxO) =>
      updateRows((current) => current.map((row) => (row.key === key ? { key, utxo } : row))),
    [updateRows]
  );

  const utxos = useMemo(() => rows.map((r) => r.utxo), [rows]);

  return {
    isCustomResponseEnabled,
    setIsCustomResponseEnabled,
    rows,
    utxos,
    error,
    addU,
    setUi,
    removeUi,
  };
}
