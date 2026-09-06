import React, { useMemo } from 'react';
import { Operario, RegistroResto, RegistroExtra, Configuración, ProgramacionSemanal } from '../types';
import { getProgramacionOperario, getSundayOfWeek, getLocalTodayStr, getMonthlyWorkedRestDays, DIA_NOMBRES } from '../lib/schedule';
import { Clock, Calendar, AlertTriangle, CheckCircle2, User, ChevronRight, ShieldCheck, Sparkles } from 'lucide-react';

interface Props {
  operarios: Operario[];
  restDays: RegistroResto[];
  extraDays: RegistroExtra[];
  config: Configuración;
  rotation: ProgramacionSemanal | null;
}

const Dashboard: React.FC<Props> = ({ operarios, restDays, extraDays, config }) => {
  const todayStr = getLocalTodayStr();
  const currentMonth = todayStr.slice(0, 7);
  const currentWeekSunday = getSundayOfWeek(todayStr);

  const now = new Date();
  const dayName = DIA_NOMBRES[now.getDay()] || 'Hoy';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Gestión Operativa</h1>
          <p className="text-sm text-gray-600">
            Monitoreo en tiempo real de turnos programados, días de descanso y horas extra acumuladas.
          </p>
        </div>
        <div className="bg-white border rounded-lg px-3 py-1.5 shadow-sm text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Calendar size={14} className="text-blue-600" />
          <span>Hoy: {dayName}, {todayStr}</span>
        </div>
      </div>

      {/* Operarios Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {operarios.map((op) => {
          // 1. Programación teórica de respaldo
          const theoreticalShift = getProgramacionOperario(op.id, todayStr);

          // 2. Cruce con registro real de hoy (si ya registró jornada en extraDays o restDays)
          const todayRealExtra = (extraDays || []).find(
            (ed) => ed && ed.operarioId === op.id && ed.fecha === todayStr
          );
          const todayRealRest = !todayRealExtra
            ? (restDays || []).find((rd) => rd && rd.operarioId === op.id && rd.fecha === todayStr && rd.trabajo)
            : null;

          const hasRealRecord = Boolean(todayRealExtra || todayRealRest);

          let shiftTurnoText: string = theoreticalShift.turno;
          let shiftHorarioText: string = theoreticalShift.horario;
          let shiftMaquinaText = theoreticalShift.maquina || '';
          let shiftBadgeStyle =
            theoreticalShift.turno === 'Turno Día'
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : theoreticalShift.turno === 'Turno Noche'
              ? 'bg-indigo-900 text-white'
              : 'bg-yellow-100 text-yellow-900 border border-yellow-300';
          let isDescansoWorkedToday = false;

          if (todayRealExtra) {
            isDescansoWorkedToday = Boolean(todayRealExtra.esDescansoTrabajado);
            if (isDescansoWorkedToday) {
              const startH = todayRealExtra.horaInicio || '06:00';
              const baseName = startH >= '14:00' ? 'Turno Noche' : 'Turno Día';
              shiftTurnoText = `${baseName} — Descanso trabajado`;
              shiftBadgeStyle = 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold';
            } else {
              shiftTurnoText = todayRealExtra.turnoProgramado || theoreticalShift.turno || 'Turno Día';
              shiftBadgeStyle = 'bg-blue-100 text-blue-900 border border-blue-300 font-bold';
            }
            shiftHorarioText = `${todayRealExtra.horaInicio || '06:00'}–${todayRealExtra.horaFin || '14:00'} (${todayRealExtra.totalHoras || 8}h)`;
            shiftMaquinaText = todayRealExtra.maquina || theoreticalShift.maquina || '';
          } else if (todayRealRest) {
            isDescansoWorkedToday = true;
            shiftTurnoText = 'Turno Día — Descanso trabajado';
            shiftHorarioText = `06:00–14:00 (${todayRealRest.horas || 8}h)`;
            shiftBadgeStyle = 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold';
            shiftMaquinaText = theoreticalShift.maquina || '';
          }

          // 3. Conteo unificado de descansos trabajados en el mes
          const { count: restCount } = getMonthlyWorkedRestDays(op.id, currentMonth, restDays, extraDays);
          const maxRestAllowed = Number(config?.topeDiasDescanso || 4);

          // 4. Conteo de Horas Extras acumuladas en el mes
          const extraMonth = (extraDays || [])
            .filter((ed) => ed && ed.operarioId === op.id && ed.fecha && ed.fecha.startsWith(currentMonth))
            .reduce((s, ed) => {
              const d = Number(ed.extraDiurna || 0);
              const n = Number(ed.extraNocturna || 0);
              const dom = Number(ed.extraDominical || 0);
              return s + (isNaN(d) ? 0 : d) + (isNaN(n) ? 0 : n) + (isNaN(dom) ? 0 : dom);
            }, 0);

          const extraDiurnaMonth = (extraDays || [])
            .filter((ed) => ed && ed.operarioId === op.id && ed.fecha && ed.fecha.startsWith(currentMonth))
            .reduce((s, ed) => {
              const d = Number(ed.extraDiurna || 0);
              return s + (isNaN(d) ? 0 : d);
            }, 0);

          const extraNocturnaMonth = (extraDays || [])
            .filter((ed) => ed && ed.operarioId === op.id && ed.fecha && ed.fecha.startsWith(currentMonth))
            .reduce((s, ed) => {
              const n = Number(ed.extraNocturna || 0);
              return s + (isNaN(n) ? 0 : n);
            }, 0);

          const extraDominicalMonth = (extraDays || [])
            .filter((ed) => ed && ed.operarioId === op.id && ed.fecha && ed.fecha.startsWith(currentMonth))
            .reduce((s, ed) => {
              const dom = Number(ed.extraDominical || 0);
              return s + (isNaN(dom) ? 0 : dom);
            }, 0);

          let alertBorder = 'border-gray-200';
          let alertBadge = 'bg-green-100 text-green-800';
          let alertText = 'Estado óptimo';

          if (restCount === 1) {
            alertBorder = 'border-blue-200';
            alertBadge = 'bg-blue-100 text-blue-800';
            alertText = '1 de 4 descansos trabajados';
          } else if (restCount === 2) {
            alertBorder = 'border-yellow-400';
            alertBadge = 'bg-yellow-100 text-yellow-800';
            alertText = '2 de 4 descansos trabajados';
          } else if (restCount === 3) {
            alertBorder = 'border-orange-400';
            alertBadge = 'bg-orange-100 text-orange-800 font-semibold';
            alertText = 'Alerta: Queda 1 día disponible (3/4)';
          } else if (restCount >= maxRestAllowed) {
            alertBorder = 'border-red-500';
            alertBadge = 'bg-red-100 text-red-800 font-bold';
            alertText = `Tope mensual alcanzado (${restCount}/${maxRestAllowed})`;
          }

          return (
            <div
              key={op.id}
              className={`bg-white rounded-xl shadow-sm border-2 ${alertBorder} p-5 space-y-4 hover:shadow-md transition`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{op.nombre}</h2>
                  <span className="text-xs text-gray-500">Operario Maquinaria Amarilla</span>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${alertBadge}`}>
                  {alertText}
                </span>
              </div>

              {/* Turno Hoy */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Turno de Hoy ({theoreticalShift.nombreDia})
                  </div>
                  {hasRealRecord ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 size={11} />
                      Real Registrado
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-medium">
                      Programación Teórica
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className={`font-black text-xs sm:text-sm px-2 py-1 rounded ${shiftBadgeStyle}`}>
                    {shiftTurnoText}
                  </span>
                  <span className="text-xs font-semibold text-gray-700 shrink-0">
                    {shiftHorarioText}
                  </span>
                </div>

                {shiftMaquinaText && (
                  <div className="text-xs text-gray-600 font-medium flex items-center justify-between pt-1 border-t border-gray-100">
                    <span>Máquina asignada:</span>
                    <span className="font-bold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200">
                      {shiftMaquinaText}
                    </span>
                  </div>
                )}
              </div>

              {/* Días Descanso Progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-gray-700">
                  <span>Descansos trabajados (Mes):</span>
                  <span className="font-bold">{restCount} / {config.topeDiasDescanso} días</span>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      restCount >= 4 ? 'bg-red-600' : restCount === 3 ? 'bg-orange-500' : restCount === 2 ? 'bg-yellow-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, (restCount / config.topeDiasDescanso) * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Horas Extra Breakdown */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600 font-medium">Horas Extra Acumuladas:</span>
                  <span className="text-base font-black text-blue-700">{extraMonth.toFixed(1)} h</span>
                </div>

                <div className="grid grid-cols-3 gap-1 text-[11px] text-center">
                  <div className="bg-amber-50 p-1 rounded border border-amber-200 text-amber-900">
                    <div className="font-bold">{extraDiurnaMonth.toFixed(1)}h</div>
                    <div className="text-[10px] text-amber-700">Diurnas</div>
                  </div>
                  <div className="bg-indigo-50 p-1 rounded border border-indigo-200 text-indigo-900">
                    <div className="font-bold">{extraNocturnaMonth.toFixed(1)}h</div>
                    <div className="text-[10px] text-indigo-700">Nocturnas</div>
                  </div>
                  <div className="bg-purple-50 p-1 rounded border border-purple-200 text-purple-900">
                    <div className="font-bold">{extraDominicalMonth.toFixed(1)}h</div>
                    <div className="text-[10px] text-purple-700">Dom/Fest</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overview Info Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base">Esquema Rotativo 24/7 de Maquinaria Amarilla</h3>
          <p className="text-xs text-slate-300 mt-1">
            Turno Día 06:00–14:00 (2 operarios) · Turno Noche 14:00–22:00 (1 operario) · Disponibilidad 22:00–06:00
          </p>
        </div>
        <div className="text-xs bg-slate-700/80 px-4 py-2 rounded-lg border border-slate-600 font-medium text-slate-200">
          Base legal: Tope 2h extras diarias / 12h semanales
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
