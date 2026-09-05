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

export const loadConfig = (): Configuración => {
  const saved = localStorage.getItem('appConfig');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Error parsing config", e);
    }
  }
  return defaultConfig;
};

export const saveConfig = (config: Configuración) => {
  localStorage.setItem('appConfig', JSON.stringify(config));
};
