import { COLOMBIAN_HOLIDAYS } from './schedule';

export interface DesgloseHorasResult {
  totalHoras: number;
  ordinarias: number;
  extraDiurna: number;
  extraNocturna: number;
  extraDominical: number;
  esDomingo: boolean;
  esFestivo: boolean;
  detalles: {
    inicioMinutos: number;
    finMinutos: number;
    duracionMinutos: number;
    extraDiurnaMinutos: number;
    extraNocturnaMinutos: number;
    extraDominicalMinutos: number;
  };
}

/**
 * Converts a "HH:mm" time string into minutes from midnight (0..1439)
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Converts minutes to "HH:mm" format
 */
export function minutesToTimeString(minutes: number): string {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates the exact breakdown of ordinary, extra diurnal, extra nocturnal, and extra dominical/holiday hours
 */
export function calcularDesgloseHoras(params: {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  esDescanso?: boolean;
  esFestivoOverride?: boolean;
  maxOrdinarias?: number;
}): DesgloseHorasResult {
  const { fecha, horaInicio, horaFin, esDescanso = false, esFestivoOverride, maxOrdinarias = 8 } = params;

  const parts = fecha.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayOfWeek = d.getDay(); // 0 is Sunday
  const esDomingo = dayOfWeek === 0;
  const esFestivo = esFestivoOverride !== undefined ? esFestivoOverride : COLOMBIAN_HOLIDAYS.has(fecha);
  const esDomOFestivo = esDomingo || esFestivo;

  const startMin = timeStringToMinutes(horaInicio);
  let endMin = timeStringToMinutes(horaFin);

  // If end time is before or equal to start time, the shift ended the next day
  if (endMin <= startMin) {
    endMin += 1440;
  }

  const duracionMinutos = endMin - startMin;
  const totalHoras = Math.round((duracionMinutos / 60) * 10) / 10;

  const maxOrdinariasMinutos = maxOrdinarias * 60;

  let ordinariasMinutos = 0;
  let extraDiurnaMinutos = 0;
  let extraNocturnaMinutos = 0;
  let extraDominicalMinutos = 0;

  if (esDomOFestivo) {
    if (esDescanso) {
      // If it's a rest day worked on Sunday/Holiday, all hours are dominical/festive extra
      extraDominicalMinutos = duracionMinutos;
      ordinariasMinutos = 0;
    } else {
      // Standard shift on Sunday/Holiday
      ordinariasMinutos = Math.min(duracionMinutos, maxOrdinariasMinutos);
      extraDominicalMinutos = Math.max(0, duracionMinutos - maxOrdinariasMinutos);
    }
  } else if (esDescanso) {
    // Rest day worked during the week (Mon-Sat)
    // The first 8 hours are ordinary, remainder are daytime/nighttime extra
    ordinariasMinutos = Math.min(duracionMinutos, maxOrdinariasMinutos);
    
    for (let m = startMin + maxOrdinariasMinutos; m < endMin; m++) {
      const minuteOfDay = m % 1440;
      // Diurnal: 06:00 (360) to 21:00 (1260)
      if (minuteOfDay >= 360 && minuteOfDay < 1260) {
        extraDiurnaMinutos++;
      } else {
        extraNocturnaMinutos++;
      }
    }
  } else {
    // Normal working day (Mon-Sat)
    ordinariasMinutos = Math.min(duracionMinutos, maxOrdinariasMinutos);

    for (let m = startMin + maxOrdinariasMinutos; m < endMin; m++) {
      const minuteOfDay = m % 1440;
      // Diurnal: 06:00 (360) to 21:00 (1260)
      if (minuteOfDay >= 360 && minuteOfDay < 1260) {
        extraDiurnaMinutos++;
      } else {
        extraNocturnaMinutos++;
      }
    }
  }

  const round1Dec = (val: number) => Math.round((val / 60) * 10) / 10;

  return {
    totalHoras,
    ordinarias: round1Dec(ordinariasMinutos),
    extraDiurna: round1Dec(extraDiurnaMinutos),
    extraNocturna: round1Dec(extraNocturnaMinutos),
    extraDominical: round1Dec(extraDominicalMinutos),
    esDomingo,
    esFestivo,
    detalles: {
      inicioMinutos: startMin,
      finMinutos: endMin,
      duracionMinutos,
      extraDiurnaMinutos,
      extraNocturnaMinutos,
      extraDominicalMinutos,
    },
  };
}
