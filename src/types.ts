export interface Operario {
  id: string;
  nombre: string;
}

export type TipoTurno = 'Turno Día' | 'Turno Noche' | 'Descanso';
export type TipoDisponibilidad = 'Ninguna' | 'Primario' | 'Respaldo';

export interface DiaProgramacion {
  turno: TipoTurno;
  horario: string;
  maquina?: string;
  disponibilidad?: TipoDisponibilidad;
}

export interface ProgramacionSemanal {
  id: string;
  fechaInicio: string; // Domingo de inicio YYYY-MM-DD
  rotacion: Record<string, Record<string, DiaProgramacion>>; // operarioId -> diaNombre -> DiaProgramacion
  cargaNocturna?: Record<string, number>;
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
  horaInicio?: string;
  horaFin?: string;
  turnoProgramado?: string;
  maquina?: string;
  ordinarias: number;
  extraDiurna: number;
  extraNocturna: number;
  extraDominical: number;
  totalHoras?: number;
  esFestivo?: boolean;
  observaciones?: string;
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
