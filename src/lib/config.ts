import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Configuración } from '../types';

export const defaultConfig: Configuración = {
  topeDiasDescanso: 4,
  topeHorasExtraDiarias: 2,
  topeHorasExtraSemanales: 12,
  horasDescansoMinimo: 10,
  recargoNocturnoSimple: 35,
  extraDiurnaPorc: 25,
  extraNocturnaPorc: 75,
  extraDominicalPorc: 100,
  salariosBase: { '1': 2000000, '2': 2000000, '3': 2000000 },
  pin: '3576'
};

const CONFIG_DOC_PATH = 'settings/config';

export const subscribeConfig = (callback: (config: Configuración) => void) => {
  const docRef = doc(db, 'settings', 'config');
  return onSnapshot(
    docRef,
    async (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as Configuración);
      } else {
        // Initialize config from localStorage or default
        const localSaved = localStorage.getItem('appConfig');
        let initial = defaultConfig;
        if (localSaved) {
          try {
            initial = { ...defaultConfig, ...JSON.parse(localSaved) };
          } catch (e) {
            console.error('Error parsing local config', e);
          }
        }
        await saveConfig(initial);
        callback(initial);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, CONFIG_DOC_PATH);
    }
  );
};

export const saveConfig = async (config: Configuración) => {
  try {
    const docRef = doc(db, 'settings', 'config');
    await setDoc(docRef, config);
    // Keep in sync with localStorage as offline fallback
    localStorage.setItem('appConfig', JSON.stringify(config));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, CONFIG_DOC_PATH);
  }
};
