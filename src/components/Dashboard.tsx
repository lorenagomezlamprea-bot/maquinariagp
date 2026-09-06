import React, { useMemo } from 'react';
import { Operario, RegistroResto, RegistroExtra, Configuración, ProgramacionSemanal } from '../types';
import { getProgramacionOperario, getSundayOfWeek, DIA_NOMBRES } from '../lib/schedule';
import { Clock, Calendar, AlertTriangle, CheckCircle2, User, ChevronRight } from 'lucide-react';

interface Props {
  operarios: Operario[];
  restDays: RegistroResto[];
  extraDays: RegistroExtra[];
  config: Configuración;
  rotation: ProgramacionSemanal | null;
}

const Dashboard: React.FC<Props> = ({ operarios, restDays, extraDays, config }) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonth = todayStr.slice(0, 7);
  const currentWeekSunday = getSundayOfWeek(todayStr);

  const now = new Date();
  const dayName = DIA_NOMBRES[now.getDay()];

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
          const shift = getProgramacionOperario(op.id, todayStr);

          // Count unique worked rest dates in current month
          const workedRestDates = new Set<string>();
          restDays.forEach((rd) => {
            if (rd.operarioId === op.id && rd.fecha.startsWith(currentMonth) && rd.trabajo) {
              workedRestDates.add(rd.fecha);
            }
          });
          extraDays.forEach((ed) => {
            if (ed.operarioId === op.id && ed.fecha.startsWith(currentMonth) && ed.esDescansoTrabajado) {
              workedRestDates.add(ed.fecha);
            }
          });
          const restCount = workedRestDates.size;

          const extraMonth = extraDays
            .filter((ed) => ed.operarioId === op.id && ed.fecha.startsWith(currentMonth))
            .reduce((s, ed) => s + (ed.extraDiurna || 0) + (ed.extraNocturna || 0) + (ed.extraDominical || 0), 0);

          const extraDiurnaMonth = extraDays
            .filter((ed) => ed.operarioId === op.id && ed.fecha.startsWith(currentMonth))
            .reduce((s, ed) => s + (ed.extraDiurna || 0), 0);

          const extraNocturnaMonth = extraDays
            .filter((ed) => ed.operarioId === op.id && ed.fecha.startsWith(currentMonth))
            .reduce((s, ed) => s + (ed.extraNocturna || 0), 0);

          const extraDominicalMonth = extraDays
            .filter((ed) => ed.operarioId === op.id && ed.fecha.startsWith(currentMonth))
            .reduce((s, ed) => s + (ed.extraDominical || 0), 0);

          let alertBorder = 'border-gray-200';
          let alertBadge = 'bg-green-100 text-green-800';
          let alertText = 'Estado óptimo';

          if (restCount === 2) {
            alertBorder = 'border-yellow-400';
            alertBadge = 'bg-yellow-100 text-yellow-800';
            alertText = '2 de 4 descansos trabajados';
          } else if (restCount === 3) {
            alertBorder = 'border-orange-400';
            alertBadge = 'bg-orange-100 text-orange-800';
            alertText = 'Alerta: Queda 1 día disponible';
          } else if (restCount >= config.topeDiasDescanso) {
            alertBorder = 'border-red-500';
            alertBadge = 'bg-red-100 text-red-800 font-bold';
            alertText = 'Tope mensual alcanzado';
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
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Turno de Hoy ({shift.nombreDia})
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`font-black text-sm px-2 py-0.5 rounded ${
                      shift.turno === 'Turno Día'
                        ? 'bg-amber-100 text-amber-900'
                        : shift.turno === 'Turno Noche'
                        ? 'bg-indigo-900 text-white'
                        : 'bg-yellow-200 text-yellow-900'
                    }`}
                  >
                    {shift.turno}
                  </span>
                  <span className="text-xs font-semibold text-gray-600">
                    {shift.horario}
                  </span>
                </div>
                {shift.maquina && (
                  <div className="text-xs text-gray-600 font-medium">
                    Máquina: <span className="font-bold text-gray-800">{shift.maquina}</span>
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
                      restCount >= 4 ? 'bg-red-600' : restCount === 3 ? 'bg-orange-500' : 'bg-blue-600'
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
