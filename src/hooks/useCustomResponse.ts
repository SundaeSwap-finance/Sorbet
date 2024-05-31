import { useEffect, useState } from "react";
import { CustomResponseStorageKeys, makeStorageChangeListener } from "../utils/storage";
import { UTxO } from "../utils/utxo";

export function useCustomResponse() {
  /** Retrieve values from storage & connect to state */
  useEffect(() => {
    chrome.storage.sync.get(
      [CustomResponseStorageKeys.MOCK_UTXOS, CustomResponseStorageKeys.CUSTOM_RESPONSE_ENABLED],
      function (result) {
        _setUtxos(result[CustomResponseStorageKeys.MOCK_UTXOS] ?? []);
        _setIsCustomResponseEnabled(result[CustomResponseStorageKeys.CUSTOM_RESPONSE_ENABLED] ?? false);
      }
    );
  }, []);

  useEffect(() => {
    return makeStorageChangeListener(CustomResponseStorageKeys.CUSTOM_RESPONSE_ENABLED, _setIsCustomResponseEnabled)
  }, [])
  const [utxos, _setUtxos] = useState<UTxO[]>([])
  const setUtxos = (utxos: UTxO[]) => {
    chrome.storage.sync.set({ [CustomResponseStorageKeys.MOCK_UTXOS]: utxos }, () => {
      _setUtxos(utxos)
    });
  }
  const [isCustomResponseEnabled, _setIsCustomResponseEnabled] = useState(false)
  const setIsCustomResponseEnabled = (b: boolean) => {
    chrome.storage.sync.set({ [CustomResponseStorageKeys.CUSTOM_RESPONSE_ENABLED]: b }, () => {
      _setIsCustomResponseEnabled(b)
    });
  }
  const addU = () => setUtxos([...utxos ?? [], {
    amount: [{ quantity: '0', unit: 'lovelace' }],
    address: '', output_index: 0, tx_hash: '',
  }])

  const removeUi = (idx: number) => {
    const newUtxos = [...utxos ?? []]
    newUtxos.splice(idx, 1)
    setUtxos([...newUtxos])
  }
  const setUi = (idx: number, u: UTxO) => {
    const newUtxos = [...utxos ?? []]
    newUtxos[idx] = u
    setUtxos([...newUtxos])
  }
  return {
    isCustomResponseEnabled, setIsCustomResponseEnabled,
    utxos,
    addU, setUi, removeUi,
  }
}