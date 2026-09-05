export interface Operario {
  id: string;
  nombre: string;
}

export type TipoTurno = 'Turno Día' | 'Turno Noche' | 'Descanso';
export type TipoDisponibilidad = 'Ninguna' | 'Primario' | 'Respaldo';

export interface DiaProgramacion {
  turno: TipoTurno;
  disponibilidad: TipoDisponibilidad;
}

export interface ProgramacionSemanal {
  id: string;
  fechaInicio: string;
  rotacion: Record<string, Record<string, DiaProgramacion>>; // operarioId -> dia -> DiaProgramacion
  cargaNocturna: Record<string, number>; // operarioId -> totalNoches (Turno Noche + Disponibilidad)
}

export interface RegistroResto {
  id: string;
  operarioId: string;
  fecha: string; // ISO format YYYY-MM-DD
  tipoDia: 'Descanso entre semana' | 'Domingo programado';
  trabajo: boolean;
  horas: number;
}

export interface RegistroExtra {
  id: string;
  operarioId: string;
  fecha: string;
  ordinarias: number;
  extraDiurna: number;
  extraNocturna: number;
  extraDominical: number;
}

export interface Configuración {
  topeDiasDescanso: number;
  topeHorasExtraDiarias: number;
  topeHorasExtraSemanales: number;
  horasDescansoMinimo: number;
  recargoNocturnoSimple: number; // %
  extraDiurnaPorc: number; // %
  extraNocturnaPorc: number; // %
  extraDominicalPorc: number; // %
  salariosBase: Record<string, number>; // operarioId -> salary
  pin: string;
}

export interface MensualState {
  noches_acumuladas: Record<string, number>;
  ultimo_operario_en_noche: string | null;
  ultimo_operario_descanso_domingo: string | null;
}
