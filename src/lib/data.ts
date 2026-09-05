import { RegistroResto, RegistroExtra } from '../types';

export const loadRestDays = (): RegistroResto[] => {
  const saved = localStorage.getItem('restDays');
  return saved ? JSON.parse(saved) : [];
};

export const saveRestDays = (data: RegistroResto[]) => {
  localStorage.setItem('restDays', JSON.stringify(data));
};

export const loadExtraDays = (): RegistroExtra[] => {
  const saved = localStorage.getItem('extraDays');
  return saved ? JSON.parse(saved) : [];
};

export const saveExtraDays = (data: RegistroExtra[]) => {
  localStorage.setItem('extraDays', JSON.stringify(data));
};
