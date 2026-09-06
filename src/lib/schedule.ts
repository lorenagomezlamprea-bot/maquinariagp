import { DiaProgramacion, Operario } from '../types';

export interface ShiftInfo {
  turno: 'Turno Día' | 'Turno Noche' | 'Descanso';
  horario: string;
  horaInicioDefault: string;
  horaFinDefault: string;
  maquina: string;
  esDescanso: boolean;
  esDomingo: boolean;
  esFestivo: boolean;
  nombreDia: string;
}

// 3 Standard Weekly Patterns (indexed 0..6 for Dom, Lun, Mar, Mié, Jue, Vie, Sáb)
export const ROTATION_PATTERNS: Record<number, DiaProgramacion[]> = {
  // Pattern 0 (Wilson Moreno in reference week of Sep 6, 2026)
  0: [
    { turno: 'Descanso', horario: 'DESCANSO', maquina: '' },
    { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'RETROEXCAVADORA' },
    { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'RETROEXCAVADORA' },
    { turno: 'Turno Noche', horario: '14:00–22:00', maquina: 'MIXTO' },
    { turno: 'Turno Noche', horario: '14:00–22:00', maquina: 'MIXTO' },
    { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'MIXTO' },
    { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'EXCAVADORA' },
  ],
  // Pattern 1 (Orlando Vargas in reference week of Sep 6, 2026)
  1: [
    { turno: 'Turno Noche', horario: '14:00–22:00', maquina: 'MIXTO' },
    { turno: 'Turno Noche', horario: '14:00–22:00', maquina: 'MIXTO' },
    { turno: 'Turno Noche', horario: '14:00–22:00', maquina: 'MIXTO' },
    { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'EXCAVADORA' },
    { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'MIXTO' },
    { turno: 'Descanso', horario: 'DESCANSO', maquina: '' },
    { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'RETROEXCAVADORA' },
  ],
  // Pattern 2 (Fidel Castro in reference week of Sep 6, 2026)
  2: [
    { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'MIXTO' },
    { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'EXCAVADORA' },
    { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'EXCAVADORA' },
    { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'RETROEXCAVADORA' },
    { turno: 'Descanso', horario: 'DESCANSO', maquina: '' },
    { turno: 'Turno Noche', horario: '14:00–22:00', maquina: 'MIXTO' },
    { turno: 'Turno Noche', horario: '14:00–22:00', maquina: 'MIXTO' },
  ],
};

// Known Colombian Holidays (YYYY-MM-DD) for 2025/2026/2027
export const COLOMBIAN_HOLIDAYS = new Set([
  // 2026
  '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29',
  '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02',
  '2026-11-16', '2026-12-08', '2026-12-25',
  // 2025
  '2025-01-01', '2025-01-06', '2025-03-24', '2025-04-17', '2025-04-18',
  '2025-05-01', '2025-06-02', '2025-06-23', '2025-06-30', '2025-07-20',
  '2025-08-07', '2025-08-18', '2025-10-13', '2025-11-03', '2025-11-17',
  '2025-12-08', '2025-12-25'
]);

export const DIA_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Reference base Sunday: Sep 6, 2026
const BASE_SUNDAY = new Date(2026, 8, 6, 0, 0, 0); // Month is 0-indexed (8 = Sep)

// Default base assignment on Sep 6, 2026:
// Operario '1' (Fidel Castro) -> Pattern 2
// Operario '2' (Orlando Vargas) -> Pattern 1
// Operario '3' (Wilson Moreno) -> Pattern 0
export const DEFAULT_BASE_PATTERN_MAP: Record<string, number> = {
  '1': 2, // Fidel
  '2': 1, // Orlando
  '3': 0, // Wilson
};

// Helper function to safely parse dates without throwing or returning NaN
function parseSafeDate(dateStr?: string): { date: Date; valid: boolean } {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim().length < 8) {
    return { date: new Date(), valid: false };
  }
  const parts = dateStr.trim().split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return { date: new Date(), valid: false };
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) {
    return { date: new Date(), valid: false };
  }
  return { date: d, valid: true };
}

/**
 * Calculates the Sunday date string (YYYY-MM-DD) for any given date
 */
export function getSundayOfWeek(dateStr?: string): string {
  const { date: d } = parseSafeDate(dateStr);
  const dayOfWeek = d.getDay(); // 0 is Sunday
  const safeDayOfWeek = isNaN(dayOfWeek) ? 0 : dayOfWeek;
  const sunday = new Date(d);
  sunday.setDate(sunday.getDate() - safeDayOfWeek);
  
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, '0');
  const day = String(sunday.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Calculates the pattern index for an operario on a given date based on weekly rotation
 */
export function getOperarioPatternIndex(operarioId: string, dateStr?: string): number {
  const sundayStr = getSundayOfWeek(dateStr);
  const { date: targetSunday } = parseSafeDate(sundayStr);
  
  const diffMs = targetSunday.getTime() - BASE_SUNDAY.getTime();
  let diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  if (isNaN(diffWeeks)) diffWeeks = 0;
  
  const opNum = Number(operarioId);
  const baseIndex = DEFAULT_BASE_PATTERN_MAP[operarioId] ?? (!isNaN(opNum) ? (opNum % 3) : 0);
  // Cyclical rotation every week: (baseIndex + diffWeeks) mod 3
  const patternIndex = ((baseIndex + diffWeeks) % 3 + 3) % 3;
  return isNaN(patternIndex) ? 0 : patternIndex;
}

/**
 * Returns the scheduled shift details for a specific operario on a given date
 */
export function getProgramacionOperario(operarioId: string, dateStr?: string): ShiftInfo {
  const { date: d } = parseSafeDate(dateStr);
  const rawDayIndex = d.getDay();
  const dayIndex = isNaN(rawDayIndex) ? 0 : rawDayIndex;
  const safeDayIndex = (dayIndex >= 0 && dayIndex <= 6) ? dayIndex : 0;
  const nombreDia = DIA_NOMBRES[safeDayIndex] || 'Domingo';
  
  const esDomingo = safeDayIndex === 0;
  const esFestivo = dateStr ? COLOMBIAN_HOLIDAYS.has(dateStr) : false;
  
  const patternIndex = getOperarioPatternIndex(operarioId, dateStr);
  const safePatternIndex = (patternIndex >= 0 && patternIndex <= 2) ? patternIndex : 0;
  const pattern = ROTATION_PATTERNS[safePatternIndex] || ROTATION_PATTERNS[0];
  const daySchedule = (pattern && pattern[safeDayIndex]) || { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'MIXTO' };
  
  const turno = daySchedule.turno || 'Turno Día';
  const horario = daySchedule.horario || '06:00–14:00';
  const maquina = daySchedule.maquina || '';
  const esDescanso = turno === 'Descanso';
  
  let horaInicioDefault = '06:00';
  let horaFinDefault = '14:00';
  
  if (turno === 'Turno Noche') {
    horaInicioDefault = '14:00';
    horaFinDefault = '22:00';
  } else if (turno === 'Turno Día') {
    horaInicioDefault = '06:00';
    horaFinDefault = '14:00';
  } else {
    // Descanso default
    horaInicioDefault = '06:00';
    horaFinDefault = '14:00';
  }
  
  return {
    turno,
    horario,
    horaInicioDefault,
    horaFinDefault,
    maquina,
    esDescanso,
    esDomingo,
    esFestivo,
    nombreDia,
  };
}

/**
 * Returns the full 7-day schedule matrix for a specific week starting on Sunday
 */
export function getWeekScheduleMatrix(sundayDateStr: string, operarios: Operario[]) {
  const sundayStr = getSundayOfWeek(sundayDateStr);
  const { date: baseDate } = parseSafeDate(sundayStr);
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({
      dateStr,
      dayIndex: i,
      name: DIA_NOMBRES[i] || '',
      formatted: `${(DIA_NOMBRES[i] || '').toLowerCase()}, ${d.getDate()} de ${d.toLocaleString('es-ES', { month: 'long' })} de ${d.getFullYear()}`,
      isHoliday: COLOMBIAN_HOLIDAYS.has(dateStr),
    });
  }
  
  const safeOperarios = operarios || [];
  const rows = safeOperarios.map(op => {
    const patternIdx = getOperarioPatternIndex(op.id, sundayStr);
    const safePatternIdx = (patternIdx >= 0 && patternIdx <= 2) ? patternIdx : 0;
    const pattern = ROTATION_PATTERNS[safePatternIdx] || ROTATION_PATTERNS[0];
    return {
      operario: op,
      patternIndex: safePatternIdx,
      shifts: days.map((day, idx) => ({
        ...(pattern[idx] || { turno: 'Turno Día', horario: '06:00–14:00', maquina: 'MIXTO' }),
        dateStr: day.dateStr,
        isSunday: idx === 0,
        isHoliday: day.isHoliday,
      }))
    };
  });
  
  return { days, rows };
}
